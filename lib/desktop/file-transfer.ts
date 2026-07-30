import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { hasTauriRuntime } from "@/lib/desktop/runtime";

export type UserSelectedFile = {
  name: string;
  path: string | null;
  bytes: Uint8Array;
};

export type FileDialogFilter = {
  name: string;
  extensions: string[];
};

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function browserPickFile(accept: string): Promise<UserSelectedFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      try {
        resolve({ name: file.name, path: null, bytes: new Uint8Array(await file.arrayBuffer()) });
      } catch (caught) {
        reject(caught);
      }
    }, { once: true });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve(null);
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

export async function chooseAndReadUserFile(
  filters: FileDialogFilter[],
  title = "Selecionar arquivo",
): Promise<UserSelectedFile | null> {
  if (!hasTauriRuntime()) {
    const accept = filters.flatMap((filter) => filter.extensions.map((extension) => `.${extension}`)).join(",");
    return browserPickFile(accept);
  }
  const selected = await open({ title, multiple: false, directory: false, filters });
  if (typeof selected !== "string") return null;
  return {
    name: fileNameFromPath(selected),
    path: selected,
    bytes: await readFile(selected),
  };
}

function browserDownload(bytes: Uint8Array, fileName: string, mimeType: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function chooseAndWriteUserFile(options: {
  bytes: Uint8Array;
  defaultFileName: string;
  filters: FileDialogFilter[];
  title?: string;
  mimeType?: string;
}): Promise<string | null> {
  if (!hasTauriRuntime()) {
    browserDownload(options.bytes, options.defaultFileName, options.mimeType ?? "application/octet-stream");
    return options.defaultFileName;
  }
  const destination = await save({
    title: options.title ?? "Salvar arquivo",
    defaultPath: options.defaultFileName,
    filters: options.filters,
  });
  if (!destination) return null;
  await writeFile(destination, options.bytes);
  return destination;
}

export function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function decodeUtf8(value: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(value);
}
