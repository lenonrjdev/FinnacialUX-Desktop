import { createHash } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..', '..');
const watchdogMs = 120_000;
const retryCount = 15;
const retryDelayMs = 1_000;

function stage(message) {
  process.stdout.write(`\n==> ${message}\n`);
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const name = item.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      values.set(name, next);
      index += 1;
    } else {
      values.set(name, 'true');
    }
  }
  return values;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retry(label, action) {
  let lastError;
  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt === retryCount) break;
      process.stdout.write(`  ${label}: tentativa ${attempt} falhou; repetindo em 1 segundo...\n`);
      await sleep(retryDelayMs);
    }
  }
  throw lastError;
}

async function writeAtomic(filePath, content) {
  const temporaryPath = `${filePath}.partial`;
  await rm(temporaryPath, { force: true });
  await writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'w' });
  await rm(filePath, { force: true });
  await rename(temporaryPath, filePath);
}

async function copyAtomic(source, destination, label) {
  const temporaryPath = `${destination}.partial`;
  await rm(temporaryPath, { force: true });

  const sourceInfo = await stat(source);
  if (!sourceInfo.isFile() || sourceInfo.size <= 0) {
    throw new Error(`Arquivo de origem vazio ou invalido: ${source}`);
  }

  await retry(label, async () => {
    await rm(temporaryPath, { force: true });
    await copyFile(source, temporaryPath);
    const copiedInfo = await stat(temporaryPath);
    if (copiedInfo.size !== sourceInfo.size) {
      throw new Error(`Copia incompleta: ${copiedInfo.size} de ${sourceInfo.size} bytes`);
    }
  });

  await rm(destination, { force: true });
  await rename(temporaryPath, destination);
  process.stdout.write(`  ${label}: ${(sourceInfo.size / 1024 / 1024).toFixed(2)} MB\n`);
}

async function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function resolveInstaller(nsisDirectory, version) {
  const entries = await readdir(nsisDirectory, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.exe')) continue;
    const fullPath = path.join(nsisDirectory, entry.name);
    const info = await stat(fullPath);
    candidates.push({ name: entry.name, fullPath, mtimeMs: info.mtimeMs, size: info.size });
  }

  const preferredSuffix = `_${version}_x64-setup.exe`.toLowerCase();
  candidates.sort((left, right) => {
    const leftPreferred = left.name.toLowerCase().endsWith(preferredSuffix) ? 1 : 0;
    const rightPreferred = right.name.toLowerCase().endsWith(preferredSuffix) ? 1 : 0;
    if (leftPreferred !== rightPreferred) return rightPreferred - leftPreferred;
    return right.mtimeMs - left.mtimeMs;
  });

  const installer = candidates[0];
  if (!installer) {
    throw new Error(`Instalador NSIS nao encontrado em ${nsisDirectory}`);
  }
  if (installer.size <= 0) {
    throw new Error(`Instalador NSIS vazio: ${installer.fullPath}`);
  }

  const signature = `${installer.fullPath}.sig`;
  if (!(await exists(signature))) {
    throw new Error(`Assinatura do updater nao encontrada: ${signature}`);
  }

  return { installer: installer.fullPath, signature, size: installer.size };
}

async function acquireLock(lockPath) {
  await mkdir(path.dirname(lockPath), { recursive: true });
  try {
    const handle = await open(lockPath, 'wx');
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    await handle.close();
    return;
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }

  const lockInfo = await stat(lockPath).catch(() => null);
  const stale = !lockInfo || Date.now() - lockInfo.mtimeMs > 10 * 60 * 1000;
  if (!stale) {
    throw new Error(`Ja existe uma finalizacao em andamento. Feche o processo anterior ou remova ${lockPath}`);
  }

  await rm(lockPath, { force: true });
  const handle = await open(lockPath, 'wx');
  await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  await handle.close();
}

async function main() {
  process.chdir(root);
  const args = parseArguments(process.argv.slice(2));

  const packageJsonPath = path.join(root, 'package.json');
  const tauriConfigPath = path.join(root, 'src-tauri', 'tauri.conf.json');
  const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
  const localUpdaterPath = path.join(root, '.release', 'updater.local.json');

  const packageJson = await readJson(packageJsonPath);
  const tauriConfig = await readJson(tauriConfigPath);
  const cargoText = await readFile(cargoPath, 'utf8');
  const cargoMatch = cargoText.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m);
  const cargoVersion = cargoMatch?.[1] ?? '';
  const version = args.get('version') || String(packageJson.version || '');

  if (!version || version !== String(packageJson.version) || version !== String(tauriConfig.version) || version !== cargoVersion) {
    throw new Error(
      `As versoes nao coincidem. package.json=${packageJson.version}, tauri.conf.json=${tauriConfig.version}, Cargo.toml=${cargoVersion}`,
    );
  }

  let repository = process.env.GITHUB_REPOSITORY || '';
  if (!repository && (await exists(localUpdaterPath))) {
    const localUpdater = await readJson(localUpdaterPath);
    repository = `${localUpdater.owner}/${localUpdater.repository}`;
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('Repositorio nao resolvido. Configure o updater pelo fluxo 03 ou defina GITHUB_REPOSITORY.');
  }

  const notesPath = path.resolve(
    root,
    args.get('notes') || path.join('release', `RELEASE_NOTES_${version.replaceAll('.', '_')}.md`),
  );
  if (!(await exists(notesPath))) {
    throw new Error(`Notas da versao nao encontradas: ${notesPath}`);
  }

  const lockPath = path.join(root, '.release', 'finalize-release.lock');
  await acquireLock(lockPath);

  try {
    console.log(`FINNACIALUX DESKTOP - FINALIZANDO RELEASE EXISTENTE ${version}`);
    console.log('O instalador e o arquivo .sig existentes serao reutilizados; nenhum novo build sera executado.');

    stage('Localizando instalador NSIS e assinatura');
    const nsisDirectory = path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
    const artifacts = await resolveInstaller(nsisDirectory, version);
    console.log(`Instalador: ${artifacts.installer}`);
    console.log(`Tamanho: ${(artifacts.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Assinatura: ${artifacts.signature}`);

    stage('Preparando pasta da release');
    const releaseDirectory = path.join(root, 'releases', version);
    await mkdir(releaseDirectory, { recursive: true });

    const assetName = `FinnacialUX-Desktop_${version}_x64-setup.exe`;
    const assetPath = path.join(releaseDirectory, assetName);
    const signaturePath = `${assetPath}.sig`;
    const latestPath = path.join(releaseDirectory, 'latest.json');
    const sumsPath = path.join(releaseDirectory, 'SHA256SUMS.txt');
    const manifestPath = path.join(releaseDirectory, 'release-manifest.json');
    const releaseNotesPath = path.join(releaseDirectory, 'RELEASE_NOTES.md');

    for (const filePath of [assetPath, signaturePath, latestPath, sumsPath, manifestPath, releaseNotesPath]) {
      await rm(filePath, { force: true });
      await rm(`${filePath}.partial`, { force: true });
    }

    stage('Copiando instalador para a pasta final');
    await copyAtomic(artifacts.installer, assetPath, 'Instalador copiado');

    stage('Copiando assinatura do updater');
    await copyAtomic(artifacts.signature, signaturePath, 'Assinatura copiada');

    stage('Gerando latest.json pelo Node.js');
    const signature = (await readFile(signaturePath, 'utf8')).trim();
    if (!signature) throw new Error(`O arquivo de assinatura esta vazio: ${signaturePath}`);
    const notes = await readFile(notesPath, 'utf8');
    const tag = `desktop-v${version}`;
    const downloadUrl = `https://github.com/${repository}/releases/download/${tag}/${assetName}`;
    const latest = {
      version,
      notes,
      pub_date: new Date().toISOString(),
      platforms: {
        'windows-x86_64': {
          signature,
          url: downloadUrl,
        },
      },
    };
    await writeAtomic(latestPath, `${JSON.stringify(latest, null, 2)}\n`);
    console.log(`  Criado: ${latestPath}`);

    stage('Calculando SHA-256 do instalador');
    const hash = await sha256(assetPath);
    await writeAtomic(sumsPath, `${hash}  ${assetName}\n`);
    console.log(`  SHA-256: ${hash}`);

    stage('Gerando manifesto tecnico');
    const prerelease = version.includes('-');
    const manifest = {
      product: 'FinnacialUX Desktop',
      version,
      channel: prerelease ? 'release-candidate' : 'stable',
      prerelease,
      schemaVersion: 14,
      tag,
      repository,
      installer: assetName,
      updaterSignature: `${assetName}.sig`,
      updaterManifest: 'latest.json',
      sha256: hash,
      generatedAt: new Date().toISOString(),
    };
    await writeAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    stage('Copiando notas da versao');
    await copyAtomic(notesPath, releaseNotesPath, 'Notas copiadas');

    stage('Validando os arquivos finais');
    const required = [assetPath, signaturePath, latestPath, sumsPath, manifestPath, releaseNotesPath];
    for (const filePath of required) {
      const info = await stat(filePath);
      if (!info.isFile() || info.size <= 0) {
        throw new Error(`Arquivo final ausente ou vazio: ${filePath}`);
      }
      console.log(`  OK: ${path.basename(filePath)} (${info.size} bytes)`);
    }

    console.log(`\nRelease preparada com sucesso:\n${releaseDirectory}`);
    console.log('\nNenhuma chave privada foi copiada para a pasta da release.');
  } finally {
    await rm(lockPath, { force: true });
  }
}

const watchdog = setTimeout(() => {
  console.error(`\nERRO: a finalizacao ultrapassou ${watchdogMs / 1000} segundos e foi encerrada automaticamente.`);
  console.error('Os arquivos originais do instalador e da assinatura permanecem preservados.');
  process.exit(124);
}, watchdogMs);

try {
  await main();
  clearTimeout(watchdog);
} catch (error) {
  clearTimeout(watchdog);
  console.error(`\nFalha ao finalizar a release: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
