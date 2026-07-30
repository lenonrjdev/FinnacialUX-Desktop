import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: webcrypto,
  });
}

if (!globalThis.btoa) {
  globalThis.btoa = (value: string) => Buffer.from(value, "binary").toString("base64");
}

if (!globalThis.atob) {
  globalThis.atob = (value: string) => Buffer.from(value, "base64").toString("binary");
}
