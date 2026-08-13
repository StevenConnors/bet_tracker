import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";

const root = process.cwd();
await mkdir(`${root}/.local/mongo`, { recursive: true });
const processes = [
  spawn("mongod", ["--dbpath", `${root}/.local/mongo`, "--bind_ip", "127.0.0.1", "--port", "27017", "--quiet"], { stdio: "inherit" }),
  spawn(process.execPath, ["scripts/mail-capture.mjs", "2525", ".local/mail.json"], { stdio: "inherit" }),
  spawn("npm", ["run", "dev"], { stdio: "inherit", env: { ...process.env, MONGODB_URI: "mongodb://127.0.0.1:27017/stakeout", AUTH_SECRET: process.env.AUTH_SECRET || "local-development-secret-change-before-production", AUTH_URL: "http://127.0.0.1:3000", EMAIL_SERVER: "smtp://127.0.0.1:2525", EMAIL_FROM: "Stakeout <noreply@localhost>", ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@example.test" } }),
];
function stop() { processes.forEach(child => child.kill("SIGTERM")); }
process.on("SIGINT", stop); process.on("SIGTERM", stop); processes.forEach(child => child.on("exit", code => { if (code && code !== 0) stop(); }));
