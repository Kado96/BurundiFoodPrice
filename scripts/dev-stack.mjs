/**
 * Lance backend (:4000) + frontend (:3000) ensemble.
 * Empêche les 502 locaux dus à une API arrêtée.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";

const kids = [];

function run(name, cwd, args) {
  const child = spawn(npm, args, {
    cwd: path.join(root, cwd),
    stdio: "inherit",
    shell: isWin,
    env: process.env,
  });
  kids.push(child);
  child.on("exit", (code, signal) => {
    if (signal) return;
    console.error(`[dev-stack] ${name} stopped (code ${code}). Arrêt de la stack.`);
    shutdown(code ?? 1);
  });
  return child;
}

function shutdown(code = 0) {
  for (const c of kids) {
    try {
      if (!c.killed) c.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("[dev-stack] API → http://127.0.0.1:4000  |  Web → http://localhost:3000");
run("api", "backend", ["run", "dev"]);
run("web", "frontend", ["run", "dev"]);
