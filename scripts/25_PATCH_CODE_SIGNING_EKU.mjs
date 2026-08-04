import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const mode = process.argv[2] ?? "verify";
const rootArg = process.argv[3];

if (!rootArg || !["apply", "verify"].includes(mode)) {
  console.error(
    "Uso: node scripts/25_PATCH_CODE_SIGNING_EKU.mjs <apply|verify> <raiz-do-projeto>",
  );
  process.exit(2);
}

const root = path.resolve(rootArg);
const targetPath = path.join(root, "scripts", "windows-signing.ps1");

const replacementLines = [
  "function Test-FinnacialuxCodeSigningEku($Certificate) {",
  "  if ($null -eq $Certificate) { return $false }",
  "",
  "  foreach ($usage in @($Certificate.EnhancedKeyUsageList)) {",
  "    if ($null -eq $usage) { continue }",
  "",
  "    $oidValue = \"\"",
  "    if ($usage.PSObject.Properties.Name -contains \"Value\") {",
  "      $oidValue = [string]$usage.Value",
  "    } elseif (($usage.PSObject.Properties.Name -contains \"ObjectId\") -and $null -ne $usage.ObjectId) {",
  "      $oidValue = [string]$usage.ObjectId.Value",
  "    } elseif (($usage.PSObject.Properties.Name -contains \"Oid\") -and $null -ne $usage.Oid) {",
  "      $oidValue = [string]$usage.Oid.Value",
  "    } else {",
  "      $oidValue = [string]$usage",
  "    }",
  "",
  "    if ($oidValue -eq $script:CodeSigningEkuOid -or $oidValue -match [regex]::Escape($script:CodeSigningEkuOid)) {",
  "      return $true",
  "    }",
  "  }",
  "",
  "  foreach ($extension in @($Certificate.Extensions)) {",
  "    if ($null -eq $extension -or [string]$extension.Oid.Value -ne \"2.5.29.37\") { continue }",
  "",
  "    try {",
  "      if ($extension -is [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]) {",
  "        $ekuExtension = $extension",
  "      } else {",
  "        $ekuExtension = New-Object System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension",
  "        $ekuExtension.CopyFrom($extension)",
  "      }",
  "",
  "      foreach ($oid in @($ekuExtension.EnhancedKeyUsages)) {",
  "        if ($null -ne $oid -and [string]$oid.Value -eq $script:CodeSigningEkuOid) {",
  "          return $true",
  "        }",
  "      }",
  "    } catch {",
  "      continue",
  "    }",
  "  }",
  "",
  "  return $false",
  "}",
];

function replacement(eol) {
  return replacementLines.join(eol);
}

function verify(source) {
  const failures = [];
  if (!source.includes('$usage.PSObject.Properties.Name -contains "Value"')) {
    failures.push("a propriedade direta Value do OID nao esta sendo consultada");
  }
  if (!source.includes('[string]$usage.Value')) {
    failures.push("o valor do OID direto nao esta sendo lido");
  }
  if (!source.includes('X509EnhancedKeyUsageExtension')) {
    failures.push("a extensao EKU X509 nao possui verificacao de fallback");
  }
  if (!source.includes('[string]$extension.Oid.Value -ne "2.5.29.37"')) {
    failures.push("a extensao Enhanced Key Usage 2.5.29.37 nao esta delimitada");
  }
  if (!source.includes('[string]$oid.Value -eq $script:CodeSigningEkuOid')) {
    failures.push("o OID de Code Signing nao esta sendo comparado no fallback");
  }
  if (source.includes('return [bool]($Certificate.EnhancedKeyUsageList | Where-Object { $_.ObjectId.Value')) {
    failures.push("a verificacao historica limitada a ObjectId.Value ainda permanece");
  }
  if (failures.length > 0) {
    throw new Error(`Validador EKU ainda incorreto:\n- ${failures.join("\n- ")}`);
  }
}

const raw = await fs.readFile(targetPath, "utf8");

if (mode === "verify") {
  verify(raw);
  console.log("Validador EKU aceita Oid.Value e possui fallback pela extensao X509.");
  process.exit(0);
}

const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const pattern = /function Test-FinnacialuxCodeSigningEku\(\$Certificate\) \{[\s\S]*?\r?\n\}/u;
if (!pattern.test(raw)) {
  throw new Error("Nao foi possivel localizar Test-FinnacialuxCodeSigningEku em scripts/windows-signing.ps1.");
}

const updated = raw.replace(pattern, replacement(eol));
verify(updated);
await fs.writeFile(targetPath, updated, "utf8");
console.log(`Validador EKU corrigido: ${targetPath}`);
