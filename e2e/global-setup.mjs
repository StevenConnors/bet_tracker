import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import net from "node:net";
const root = process.cwd();
const waitForPort = (port) => new Promise((resolve, reject) => { const deadline = Date.now() + 20_000; const check = () => { const socket = net.connect(port, "127.0.0.1"); socket.on("connect", () => { socket.destroy(); resolve(); }); socket.on("error", () => { if (Date.now() > deadline) reject(new Error(`Timed out waiting for port ${port}`)); else setTimeout(check, 150); }); }; check(); });
export default async function setup() {
  await rm(`${root}/.local/e2e-mail.json`, { force: true }); await rm(`${root}/.local/e2e-mongo`, { recursive: true, force: true }); await mkdir(`${root}/.local/e2e-mongo`, { recursive: true });
  const mongo = spawn("mongod", ["--dbpath", `${root}/.local/e2e-mongo`, "--bind_ip", "127.0.0.1", "--port", "27018", "--quiet"], { stdio: "ignore" });
  const mail = spawn(process.execPath, ["scripts/mail-capture.mjs", "2526", ".local/e2e-mail.json"], { stdio: "ignore" });
  await Promise.all([waitForPort(27018), waitForPort(2526)]);
  return async () => { mongo.kill("SIGTERM"); mail.kill("SIGTERM"); };
}
