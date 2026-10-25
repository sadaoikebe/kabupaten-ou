import { cpSync, createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";

function dataPlugin(): Plugin {
  const root = resolve("data");
  const types: Record<string, string> = {
    ".json": "application/json",
    ".webp": "image/webp",
    ".png": "image/png",
  };
  return {
    name: "serve-data",
    configureServer(server) {
      server.middlewares.use("/data", (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = decodeURIComponent((req.url || "/").split("?")[0]);
        const file = normalize(join(root, url));
        if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
          next();
          return;
        }
        const ext = file.slice(file.lastIndexOf("."));
        res.setHeader("Content-Type", types[ext] || "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      mkdirSync(resolve("dist/data"), { recursive: true });
      cpSync(resolve("data/dist"), resolve("dist/data/dist"), { recursive: true });
      cpSync(resolve("data/meta"), resolve("dist/data/meta"), { recursive: true });
    },
  };
}

export default defineConfig(({ command }) => ({
  // 公開先は https://sadaoikebe.github.io/kabupaten-ou/
  // ローカルの開発サーバは今まで通り http://localhost:5173/
  base: command === "build" ? "/kabupaten-ou/" : "/",
  plugins: [dataPlugin()],
  server: { port: 5173, strictPort: false },
}));
