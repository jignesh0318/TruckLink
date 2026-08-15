import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

console.log("\x1b[36m%s\x1b[0m", "==================================================");
console.log("\x1b[32m%s\x1b[0m", "🚚 Starting TruckLink (API Server + Web App)");
console.log("\x1b[36m%s\x1b[0m", "==================================================");
console.log(" Backend API : http://localhost:3000");
console.log(" Web App     : http://localhost:5173");
console.log("==================================================\n");

// 1. Start API Server (Port 3000)
const apiProcess = spawn(
  "node",
  ["--enable-source-maps", "--env-file-if-exists=.env", "./artifacts/api-server/dist/index.mjs"],
  {
    cwd: rootDir,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PORT: process.env.API_PORT || "3000" },
  }
);

// 2. Start Vite Frontend (Port 5173)
const viteProcess = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "--config", "./artifacts/trucklink/vite.config.ts", "--host", "0.0.0.0"],
  {
    cwd: rootDir,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      PORT: process.env.PORT || "5173",
      BASE_PATH: process.env.BASE_PATH || "/",
    },
  }
);

function cleanup() {
  try {
    apiProcess.kill();
  } catch {}
  try {
    viteProcess.kill();
  } catch {}
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
