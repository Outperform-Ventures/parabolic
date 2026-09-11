import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
export function offlinePlugin(): Plugin {
  let directory = "dist";
  return {
    name: "parabolic-offline-shell",
    apply: "build",
    configResolved(config) {
      directory = resolve(config.root, config.build.outDir);
    },
    writeBundle(_options, bundle) {
      const files = [
        "/index.html",
        "/manifest.webmanifest",
        "/app-icon.svg",
        "/app-icon-256.png",
        "/app-icon-512.png",
        ...Object.keys(bundle)
          .filter(
            (file) => file.startsWith("assets/") && !file.endsWith(".map"),
          )
          .map((file) => "/" + file),
      ].sort();
      const hash = createHash("sha256")
        .update(readFileSync(resolve(directory, "index.html")))
        .update(JSON.stringify(files))
        .digest("hex")
        .slice(0, 20);
      const source = readFileSync(
        new URL("../src/client/service-worker.js", import.meta.url),
        "utf8",
      );
      writeFileSync(
        resolve(directory, "sw.js"),
        `const SHELL_CACHE=${JSON.stringify("parabolic-shell-" + hash)};\nconst SHELL_FILES=${JSON.stringify(files)};\n${source}`,
      );
    },
  };
}
