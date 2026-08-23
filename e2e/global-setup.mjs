import { execFileSync, spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import net from "node:net";
const root = process.cwd();
const waitForPort = (port) => new Promise((resolve, reject) => { const deadline = Date.now() + 30_000; const check = () => { const socket = net.connect(port, "127.0.0.1"); socket.on("connect", () => { socket.destroy(); resolve(); }); socket.on("error", () => { if (Date.now() > deadline) reject(new Error(`Timed out waiting for port ${port}`)); else setTimeout(check, 150); }); }; check(); });
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function signalProcessGroup(child, signal) {
  if (!child?.pid) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {
    // The process group has already exited.
  }
}
export default async function setup() {
  const externalMongoUri = process.env.E2E_MONGODB_URI;
  if (!externalMongoUri) { await rm(`${root}/.local/e2e-mongo`, { recursive: true, force: true }); await mkdir(`${root}/.local/e2e-mongo`, { recursive: true }); }
  await rm(`${root}/.next-e2e`, { recursive: true, force: true });
  execFileSync("npx", ["supabase", "start", "-x", "studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector"], { cwd: root, stdio: "inherit" });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { execFileSync("docker", ["exec", "supabase_auth_stakeout", "wget", "-q", "--spider", "http://supabase_kong_stakeout:8088/email/magic_link.html"], { stdio: "ignore" }); break; }
    catch { if (attempt === 39) throw new Error("Local authentication email template did not become ready"); await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  const output = execFileSync("npx", ["supabase", "status", "-o", "env"], { cwd: root, encoding: "utf8" });
  const local = Object.fromEntries([...output.matchAll(/^([A-Z_]+)="(.*)"$/gm)].map(([, key, value]) => [key, value]));
  if (!local.API_URL || !local.ANON_KEY) throw new Error("Could not read local Supabase credentials");
  const mongo = externalMongoUri ? undefined : spawn("mongod", ["--dbpath", `${root}/.local/e2e-mongo`, "--bind_ip", "127.0.0.1", "--port", "27018", "--quiet"], { detached: process.platform !== "win32", stdio: "ignore" });
  const mongoUrl = new URL(externalMongoUri || "mongodb://127.0.0.1:27018/stakeout_e2e");
  const mongoPort = Number(mongoUrl.port || 27017);
  const next = spawn("npm", ["run", "dev", "--", "--port", "3100"], { detached: process.platform !== "win32", stdio: "ignore", env: { ...process.env, APP_ORIGIN: "http://127.0.0.1:3100", INVITE_EMAIL_PROVIDER: "mailpit", INVITE_EMAIL_FROM: "Stakeout <invites@stakeout.local>", MAILPIT_SMTP_HOST: "127.0.0.1", MAILPIT_SMTP_PORT: "54325", MONGODB_URI: mongoUrl.toString(), NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_SUPABASE_URL: local.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY, ADMIN_EMAIL: "admin@example.test" } });
  try {
    await Promise.all([waitForPort(mongoPort), waitForPort(3100)]);
  } catch (error) {
    signalProcessGroup(mongo, "SIGTERM");
    signalProcessGroup(next, "SIGTERM");
    await delay(1_000);
    signalProcessGroup(mongo, "SIGKILL");
    signalProcessGroup(next, "SIGKILL");
    await rm(`${root}/.next-e2e`, { recursive: true, force: true });
    throw error;
  }
  return async () => {
    signalProcessGroup(mongo, "SIGTERM");
    signalProcessGroup(next, "SIGTERM");
    await delay(1_000);
    signalProcessGroup(mongo, "SIGKILL");
    signalProcessGroup(next, "SIGKILL");
    await rm(`${root}/.next-e2e`, { recursive: true, force: true });
  };
}
