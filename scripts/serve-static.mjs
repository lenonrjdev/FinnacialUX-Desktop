import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "out");
const port = Number(process.argv[3] ?? 4173);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function candidatePaths(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0] || "/");
  const normalized = path.posix.normalize(decoded).replace(/^\.\.(\/|\\)/g, "");
  const relative = normalized.replace(/^\/+/, "");
  if (!relative) return ["index.html"];
  if (relative.endsWith("/")) return [path.join(relative, "index.html")];
  if (path.extname(relative)) return [relative];
  return [relative, path.join(relative, "index.html")];
}

async function resolveFile(urlPath) {
  for (const candidate of candidatePaths(urlPath)) {
    const absolute = path.resolve(root, candidate);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) continue;
    try {
      if ((await stat(absolute)).isFile()) return absolute;
    } catch {
      // Continua para a próxima resolução compatível com o export estático.
    }
  }
  return path.join(root, "404.html");
}

const server = createServer(async (request, response) => {
  try {
    const filePath = await resolveFile(request.url ?? "/");
    const body = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(filePath.endsWith("404.html") ? 404 : 200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes.get(extension) ?? "application/octet-stream",
      "Content-Length": body.byteLength,
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Falha ao servir o export estático.");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`FinnacialUX E2E disponível em http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
