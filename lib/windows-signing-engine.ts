import type {
  WindowsSigningCheck,
  WindowsSigningConfiguration,
  WindowsSigningReadiness,
  WindowsSigningSnapshot,
} from "@/types/windows-signing";

const DAY_MS = 86_400_000;

export function normalizeCertificateThumbprint(value: string): string {
  return value.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

export function daysUntilCertificateExpiry(expiresAt: string | null, now = new Date()): number | null {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS);
}

export function validateWindowsSigningConfiguration(config: WindowsSigningConfiguration): string[] {
  const errors: string[] = [];
  if (config.formatVersion !== 1) errors.push("formatVersion deve ser 1");
  if (!config.publisherDisplayName.trim()) errors.push("publisherDisplayName é obrigatório");
  if (!config.expectedPublisher.trim()) errors.push("expectedPublisher é obrigatório");
  if (!/^https?:\/\//i.test(config.timestampUrl)) errors.push("timestampUrl deve usar HTTP ou HTTPS");
  if (config.digestAlgorithm !== "SHA256" || config.timestampDigestAlgorithm !== "SHA256") {
    errors.push("assinatura e timestamp devem usar SHA256");
  }
  if (config.provider === "certificate-store") {
    const thumbprint = normalizeCertificateThumbprint(config.certificateStore?.thumbprint ?? "");
    if (!/^[A-F0-9]{40,64}$/.test(thumbprint)) errors.push("thumbprint do certificado é inválido");
  } else if (config.provider === "pfx") {
    if (!config.pfx?.path.trim()) errors.push("caminho externo do PFX é obrigatório");
  } else if (config.provider === "custom-command") {
    if (!config.customCommand?.cmd.trim()) errors.push("comando customizado é obrigatório");
    if (!config.customCommand?.args.some((arg) => arg.includes("{file}") || arg.includes("%1"))) {
      errors.push("o comando customizado precisa do marcador {file} ou %1");
    }
  } else {
    errors.push("provider de assinatura desconhecido");
  }
  return errors;
}

function check(
  id: string,
  title: string,
  detail: string,
  status: WindowsSigningCheck["status"],
  required = true,
): WindowsSigningCheck {
  return { id, title, detail, status, required };
}

export function createWindowsSigningReadiness(snapshot: WindowsSigningSnapshot): WindowsSigningReadiness {
  const now = snapshot.now ? new Date(snapshot.now) : new Date();
  const expiresInDays = daysUntilCertificateExpiry(snapshot.expiresAt, now);
  const checks: WindowsSigningCheck[] = [
    check("configuration", "Configuração local", snapshot.configured ? "A política local foi encontrada." : "Configure a assinatura fora do Git.", snapshot.configured ? "passed" : "blocked"),
    check("provider", "Provedor", snapshot.provider ? `Provedor: ${snapshot.provider}.` : "Nenhum provedor foi selecionado.", snapshot.provider ? "passed" : "blocked"),
    check("tool", "Ferramenta de assinatura", snapshot.signToolAvailable || snapshot.provider === "custom-command" ? "A ferramenta necessária está disponível." : "SignTool não foi localizado no Windows SDK.", snapshot.signToolAvailable || snapshot.provider === "custom-command" ? "passed" : "blocked"),
    check("certificate", "Certificado", snapshot.certificateFound ? "O certificado foi localizado." : "O certificado não foi localizado.", snapshot.certificateFound ? "passed" : "blocked"),
    check("private-key", "Chave privada", snapshot.hasPrivateKey ? "A chave privada está acessível ao processo de release." : "A chave privada não está acessível.", snapshot.hasPrivateKey ? "passed" : "blocked"),
    check("eku", "Uso de assinatura de código", snapshot.codeSigningEku ? "O certificado permite Code Signing." : "O EKU de Code Signing não foi confirmado.", snapshot.codeSigningEku ? "passed" : "blocked"),
    check("trust", "Cadeia pública", snapshot.trustedChain ? "A cadeia de confiança foi validada." : "A cadeia ainda não foi comprovada como pública.", snapshot.trustedChain ? "passed" : "blocked"),
    check("timestamp", "Carimbo de tempo", snapshot.timestampConfigured ? "Timestamp RFC 3161 configurado com SHA-256." : "Servidor de timestamp não configurado.", snapshot.timestampConfigured ? "passed" : "blocked"),
    check("publisher", "Identidade esperada", snapshot.expectedPublisherConfigured ? "O publisher esperado foi definido." : "Defina o publisher esperado para impedir troca silenciosa de certificado.", snapshot.expectedPublisherConfigured ? "passed" : "blocked"),
  ];

  if (expiresInDays !== null) {
    checks.push(check(
      "expiry",
      "Validade do certificado",
      expiresInDays < 0 ? "O certificado está expirado." : `O certificado vence em ${expiresInDays} dia(s).`,
      expiresInDays < 0 ? "blocked" : expiresInDays <= 45 ? "attention" : "passed",
      true,
    ));
  }

  const passed = checks.filter((item) => item.status === "passed").length;
  const attention = checks.filter((item) => item.status === "attention").length;
  const blocked = checks.filter((item) => item.status === "blocked").length;
  const score = Math.max(0, Math.round((passed * 100 + attention * 55) / checks.length));
  return { ready: checks.every((item) => !item.required || item.status === "passed"), score, passed, attention, blocked, expiresInDays, checks };
}

export function sanitizeWindowsSigningError(message: string): string {
  return message
    .replace(/[A-Fa-f0-9]{64,}/g, "[SEGREDO_REMOVIDO]")
    .replace(/password\s*[=:]\s*[^\s]+/gi, "password=[SEGREDO_REMOVIDO]")
    .replace(/token\s*[=:]\s*[^\s]+/gi, "token=[SEGREDO_REMOVIDO]")
    .replace(/([\"'])[A-Za-z]:\\[^\"'\r\n]*\1/g, "[CAMINHO_REMOVIDO]")
    .replace(/\b[A-Za-z]:\\[^\s\"'<>|]+/g, "[CAMINHO_REMOVIDO]");
}
