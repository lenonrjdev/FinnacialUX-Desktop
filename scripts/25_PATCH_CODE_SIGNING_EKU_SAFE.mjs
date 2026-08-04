import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const mode = process.argv[2] ?? "verify";
const rootArg = process.argv[3];

if (!rootArg || !["apply", "verify"].includes(mode)) {
  console.error(
    "Uso: node scripts/25_PATCH_CODE_SIGNING_EKU_SAFE.mjs <apply|verify> <raiz-do-projeto>",
  );
  process.exit(2);
}

const root = path.resolve(rootArg);
const targetPath = path.join(root, "scripts", "windows-signing.ps1");

const replacementLines = [
  "function Get-FinnacialuxSafePropertyValue($InputObject, [string]$PropertyName) {",
  "  if ($null -eq $InputObject) { return $null }",
  "  try {",
  "    $property = $InputObject.PSObject.Properties[$PropertyName]",
  "    if ($null -eq $property) { return $null }",
  "    return $property.Value",
  "  } catch {",
  "    return $null",
  "  }",
  "}",
  "",
  "function Get-FinnacialuxOidValue($InputObject) {",
  "  if ($null -eq $InputObject) { return \"\" }",
  "  if ($InputObject -is [string]) { return [string]$InputObject }",
  "  if ($InputObject -is [System.Security.Cryptography.Oid]) { return [string]$InputObject.Value }",
  "",
  "  $directValue = Get-FinnacialuxSafePropertyValue $InputObject \"Value\"",
  "  if ($null -ne $directValue -and -not [string]::IsNullOrWhiteSpace([string]$directValue)) {",
  "    return [string]$directValue",
  "  }",
  "",
  "  foreach ($nestedName in @(\"ObjectId\", \"Oid\")) {",
  "    $nested = Get-FinnacialuxSafePropertyValue $InputObject $nestedName",
  "    if ($null -eq $nested) { continue }",
  "    if ($nested -is [string]) { return [string]$nested }",
  "    if ($nested -is [System.Security.Cryptography.Oid]) { return [string]$nested.Value }",
  "    $nestedValue = Get-FinnacialuxSafePropertyValue $nested \"Value\"",
  "    if ($null -ne $nestedValue -and -not [string]::IsNullOrWhiteSpace([string]$nestedValue)) {",
  "      return [string]$nestedValue",
  "    }",
  "  }",
  "",
  "  return \"\"",
  "}",
  "",
  "function Test-FinnacialuxCodeSigningEku($Certificate) {",
  "  if ($null -eq $Certificate) { return $false }",
  "",
  "  $certificateThumbprint = Normalize-FinnacialuxThumbprint ([string](Get-FinnacialuxSafePropertyValue $Certificate \"Thumbprint\"))",
  "  if (-not [string]::IsNullOrWhiteSpace($certificateThumbprint)) {",
  "    foreach ($storePath in @(\"Cert:\\CurrentUser\\My\", \"Cert:\\LocalMachine\\My\")) {",
  "      $nativeMatch = Get-ChildItem $storePath -CodeSigningCert -ErrorAction SilentlyContinue |",
  "        Where-Object { (Normalize-FinnacialuxThumbprint ([string]$_.Thumbprint)) -eq $certificateThumbprint } |",
  "        Select-Object -First 1",
  "      if ($null -ne $nativeMatch) { return $true }",
  "    }",
  "  }",
  "",
  "  $enhancedKeyUsageList = Get-FinnacialuxSafePropertyValue $Certificate \"EnhancedKeyUsageList\"",
  "  foreach ($usage in @($enhancedKeyUsageList)) {",
  "    if ((Get-FinnacialuxOidValue $usage) -eq $script:CodeSigningEkuOid) { return $true }",
  "  }",
  "",
  "  $extensions = Get-FinnacialuxSafePropertyValue $Certificate \"Extensions\"",
  "  foreach ($extension in @($extensions)) {",
  "    if ($null -eq $extension) { continue }",
  "    $extensionOid = Get-FinnacialuxOidValue (Get-FinnacialuxSafePropertyValue $extension \"Oid\")",
  "    if ($extensionOid -ne \"2.5.29.37\") { continue }",
  "",
  "    try {",
  "      if ($extension -is [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]) {",
  "        $ekuExtension = $extension",
  "      } else {",
  "        $ekuExtension = [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new()",
  "        $ekuExtension.CopyFrom([System.Security.Cryptography.X509Certificates.X509Extension]$extension)",
  "      }",
  "",
  "      foreach ($oid in @($ekuExtension.EnhancedKeyUsages)) {",
  "        if ((Get-FinnacialuxOidValue $oid) -eq $script:CodeSigningEkuOid) { return $true }",
  "      }",
  "    } catch {",
  "      continue",
  "    }",
  "  }",
  "",
  "  return $false",
  "}",
  "",
];

function replacement(eol) {
  return replacementLines.join(eol);
}

function verify(source) {
  const failures = [];
  const required = [
    ["Get-FinnacialuxSafePropertyValue", "helper seguro de propriedades ausente"],
    ['PSObject.Properties[$PropertyName]', "indexador seguro de propriedades ausente"],
    ["Get-FinnacialuxOidValue", "normalizador seguro de OID ausente"],
    ["-CodeSigningCert", "filtro nativo de Code Signing ausente"],
    ["Cert:\\CurrentUser\\My", "armazenamento CurrentUser nao verificado"],
    ["Cert:\\LocalMachine\\My", "armazenamento LocalMachine nao verificado"],
    ['"2.5.29.37"', "fallback da extensao EKU ausente"],
    ["X509EnhancedKeyUsageExtension", "parser tipado da extensao EKU ausente"],
  ];
  for (const [needle, message] of required) {
    if (!source.includes(needle)) failures.push(message);
  }
  const forbidden = [
    "$_.ObjectId.Value",
    "[string]$usage.Value",
    "[string]$extension.Oid.Value",
    "[string]$oid.Value",
  ];
  for (const needle of forbidden) {
    if (source.includes(needle)) {
      failures.push(`acesso direto inseguro ainda presente: ${needle}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`Validador EKU ainda inseguro:\n- ${failures.join("\n- ")}`);
  }
}

const raw = await fs.readFile(targetPath, "utf8");

if (mode === "verify") {
  verify(raw);
  console.log("Validador EKU usa filtro nativo e fallback tipado sem propriedades opcionais diretas.");
  process.exit(0);
}

const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const pattern = /function Test-FinnacialuxCodeSigningEku\(\$Certificate\) \{[\s\S]*?(?=\r?\nfunction Invoke-FinnacialuxExternalCommand)/u;
if (!pattern.test(raw)) {
  throw new Error(
    "Nao foi possivel localizar o bloco Test-FinnacialuxCodeSigningEku em scripts/windows-signing.ps1.",
  );
}

const updated = raw.replace(pattern, replacement(eol));
verify(updated);
await fs.writeFile(targetPath, updated, "utf8");
console.log(`Validador EKU corrigido com leitura segura: ${targetPath}`);
