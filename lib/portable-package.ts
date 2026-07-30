import type {
  PortablePackageEnvelope,
  PortablePackagePayload,
  PortableImportPreview,
} from "@/types/dados-e-automacoes";

const PORTABLE_MAGIC = "FUXPORTABLE1" as const;
const PBKDF2_ITERATIONS = 420_000;

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", asArrayBuffer(bytes)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function derivePortableKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  if (password.length < 10) throw new Error("Use uma senha com pelo menos 10 caracteres para proteger o pacote portátil.");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: asArrayBuffer(salt), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function countDocumentRecords(documents: Record<string, unknown>): number {
  return Object.values(documents).reduce<number>(
    (total, value) => total + (Array.isArray(value) ? value.length : value == null ? 0 : 1),
    0,
  );
}

export async function buildPortablePayload(options: {
  appVersion: string;
  workspaceId: string;
  documents: Record<string, unknown>;
}): Promise<PortablePackagePayload> {
  const documentChecksums: Record<string, string> = {};
  for (const [module, document] of Object.entries(options.documents)) {
    documentChecksums[module] = await sha256Hex(stableStringify(document));
  }
  return {
    product: "FinnacialUX Desktop",
    formatVersion: 1,
    appVersion: options.appVersion,
    exportedAt: new Date().toISOString(),
    sourceWorkspaceId: options.workspaceId,
    documents: options.documents,
    documentChecksums,
    totals: {
      modules: Object.keys(options.documents).length,
      records: countDocumentRecords(options.documents),
    },
  };
}

export async function encryptPortablePackage(
  payload: PortablePackagePayload,
  password: string,
): Promise<{ bytes: Uint8Array; checksumSha256: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payloadText = stableStringify(payload);
  const checksum = await sha256Hex(payloadText);
  const key = await derivePortableKey(password, salt, PBKDF2_ITERATIONS);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv), additionalData: asArrayBuffer(new TextEncoder().encode(PORTABLE_MAGIC)) },
    key,
    asArrayBuffer(new TextEncoder().encode(payloadText)),
  ));
  const envelope: PortablePackageEnvelope = {
    magic: PORTABLE_MAGIC,
    formatVersion: 1,
    encrypted: true,
    algorithm: "PBKDF2-SHA256+AES-256-GCM",
    kdf: { iterations: PBKDF2_ITERATIONS, saltB64: bytesToBase64(salt) },
    cipher: { ivB64: bytesToBase64(iv) },
    payloadChecksumSha256: checksum,
    encryptedPayloadB64: bytesToBase64(encrypted),
  };
  const outputBytes = new TextEncoder().encode(`${JSON.stringify(envelope, null, 2)}\n`);
  return {
    bytes: outputBytes,
    checksumSha256: await sha256Hex(outputBytes),
  };
}

function assertPortablePayload(value: unknown): asserts value is PortablePackagePayload {
  if (!value || typeof value !== "object") throw new Error("O conteúdo do pacote portátil é inválido.");
  const payload = value as Partial<PortablePackagePayload>;
  if (
    payload.product !== "FinnacialUX Desktop"
    || payload.formatVersion !== 1
    || typeof payload.appVersion !== "string"
    || typeof payload.exportedAt !== "string"
    || typeof payload.sourceWorkspaceId !== "string"
    || !payload.documents
    || typeof payload.documents !== "object"
    || !payload.documentChecksums
    || typeof payload.documentChecksums !== "object"
  ) {
    throw new Error("Este arquivo não é um pacote portátil compatível com o FinnacialUX Desktop.");
  }
}

export async function decryptPortablePackage(
  bytes: Uint8Array,
  password: string,
  fileName: string,
): Promise<PortableImportPreview> {
  let envelope: PortablePackageEnvelope;
  try {
    envelope = JSON.parse(new TextDecoder().decode(bytes)) as PortablePackageEnvelope;
  } catch {
    throw new Error("O pacote portátil não contém um manifesto JSON válido.");
  }
  if (
    envelope.magic !== PORTABLE_MAGIC
    || envelope.formatVersion !== 1
    || envelope.encrypted !== true
    || envelope.algorithm !== "PBKDF2-SHA256+AES-256-GCM"
  ) {
    throw new Error("Formato de pacote portátil não reconhecido.");
  }
  try {
    const key = await derivePortableKey(password, base64ToBytes(envelope.kdf.saltB64), envelope.kdf.iterations);
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: asArrayBuffer(base64ToBytes(envelope.cipher.ivB64)),
        additionalData: asArrayBuffer(new TextEncoder().encode(PORTABLE_MAGIC)),
      },
      key,
      asArrayBuffer(base64ToBytes(envelope.encryptedPayloadB64)),
    );
    const payloadText = new TextDecoder().decode(decrypted);
    const checksum = await sha256Hex(payloadText);
    if (checksum !== envelope.payloadChecksumSha256) throw new Error("A verificação de integridade do pacote falhou.");
    const payload = JSON.parse(payloadText) as unknown;
    assertPortablePayload(payload);
    for (const [module, expectedChecksum] of Object.entries(payload.documentChecksums)) {
      const actualChecksum = await sha256Hex(stableStringify(payload.documents[module]));
      if (actualChecksum !== expectedChecksum) throw new Error(`O módulo ${module} não passou na verificação de integridade.`);
    }
    return {
      fileName,
      appVersion: payload.appVersion,
      exportedAt: payload.exportedAt,
      sourceWorkspaceId: payload.sourceWorkspaceId,
      modules: Object.keys(payload.documents).sort(),
      records: payload.totals.records,
      checksumSha256: envelope.payloadChecksumSha256,
      documents: payload.documents,
    };
  } catch (caught) {
    if (caught instanceof Error && /senha|integridade|módulo|pacote/.test(caught.message)) throw caught;
    throw new Error("Não foi possível abrir o pacote. Confirme a senha e tente novamente.");
  }
}

export function mergePortableDocuments(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...current };
  for (const [module, nextValue] of Object.entries(incoming)) {
    const currentValue = current[module];
    if (!Array.isArray(nextValue) || !Array.isArray(currentValue)) {
      result[module] = nextValue;
      continue;
    }
    const existing = new Map<string, unknown>();
    for (const item of currentValue) {
      const id = item && typeof item === "object" && "id" in item ? String((item as { id: unknown }).id) : stableStringify(item);
      existing.set(id, item);
    }
    for (const item of nextValue) {
      const id = item && typeof item === "object" && "id" in item ? String((item as { id: unknown }).id) : stableStringify(item);
      existing.set(id, item);
    }
    result[module] = Array.from(existing.values());
  }
  return result;
}
