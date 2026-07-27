const ITERATIONS = 210_000;
const KEY_LENGTH = 256;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array {
  if (value.length % 2 !== 0) throw new Error("Valor hexadecimal inválido.");
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function toBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

async function derivePasswordHash(password: string, salt: Uint8Array): Promise<string> {
  const source = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toBufferSource(salt),
      iterations: ITERATIONS,
    },
    source,
    KEY_LENGTH,
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function createPasswordCredential(password: string): Promise<{
  salt: string;
  hash: string;
}> {
  const salt = crypto.getRandomValues(new Uint8Array(24));
  return {
    salt: bytesToHex(salt),
    hash: await derivePasswordHash(password, salt),
  };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const receivedHash = await derivePasswordHash(password, hexToBytes(salt));
  if (receivedHash.length !== expectedHash.length) return false;

  let difference = 0;
  for (let index = 0; index < receivedHash.length; index += 1) {
    difference |= receivedHash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return difference === 0;
}

export function createRecoveryToken(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}
