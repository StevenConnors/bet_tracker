import { execFileSync, spawn } from "node:child_process";
import { rm, mkdir } from "node:fs/promises";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mongoPort = 27017;
const appPort = 3000;
const children = [];
let stopping = false;

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const portIsOpen = port => new Promise(resolve => {
  const socket = net.connect({ host: "127.0.0.1", port });
  socket.once("connect", () => { socket.destroy(); resolve(true); });
  socket.once("error", () => resolve(false));
  socket.setTimeout(500, () => { socket.destroy(); resolve(false); });
});

async function waitForPort(port, child, name) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await portIsOpen(port)) return;
    if (child.exitCode !== null) throw new Error(`${name} exited before becoming ready (code ${child.exitCode})`);
    await delay(250);
  }
  throw new Error(`${name} did not become ready on port ${port}`);
}

async function waitForLogin(child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Next.js exited before becoming ready (code ${child.exitCode})`);
    try {
      const response = await fetch(`http://127.0.0.1:${appPort}/login`);
      if (response.ok && (await response.text()).includes("Send my sign-in code")) return;
    } catch { /* Server is still starting. */ }
    await delay(250);
  }
  throw new Error("Next.js did not serve the expected login page");
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) signalProcessGroup(child, "SIGTERM");
  setTimeout(() => {
    for (const child of children) signalProcessGroup(child, "SIGKILL");
    process.exit(code);
  }, 2_000);
}

function signalProcessGroup(child, signal) {
  if (!child.pid) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {
    // The process group has already exited.
  }
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

try {
  if (process.cwd() !== root) console.warn(`Starting Stakeout from ${root}`);
  if (await portIsOpen(appPort)) throw new Error(`Port ${appPort} is already in use. Stop the existing app server before running npm run local.`);
  if (await portIsOpen(mongoPort)) throw new Error(`Port ${mongoPort} is already in use. Stop the existing MongoDB process before running npm run local.`);

  execFileSync("docker", ["info"], { stdio: "ignore" });
  execFileSync("mongod", ["--version"], { stdio: "ignore" });
  await mkdir(join(root, ".local", "mongo"), { recursive: true });
  await rm(join(root, ".next"), { recursive: true, force: true });

  execFileSync("npx", ["--no-install", "supabase", "start", "-x", "studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector"], { cwd: root, stdio: "inherit" });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      execFileSync("docker", ["exec", "supabase_auth_stakeout", "wget", "-q", "--spider", "http://supabase_kong_stakeout:8088/email/magic_link.html"], { stdio: "ignore" });
      break;
    } catch {
      if (attempt === 39) throw new Error("Local authentication email template did not become ready");
      await delay(250);
    }
  }

  const status = execFileSync("npx", ["--no-install", "supabase", "status", "-o", "env"], { cwd: root, encoding: "utf8" });
  const local = Object.fromEntries([...status.matchAll(/^([A-Z_]+)="(.*)"$/gm)].map(([, key, value]) => [key, value]));
  if (!local.API_URL || !local.ANON_KEY) throw new Error("Could not read the local Supabase URL and anonymous key");

  const mongo = spawn("mongod", ["--dbpath", join(root, ".local", "mongo"), "--bind_ip", "127.0.0.1", "--port", String(mongoPort), "--quiet"], {
    detached: process.platform !== "win32",
    stdio: "inherit",
  });
  children.push(mongo);
  await waitForPort(mongoPort, mongo, "MongoDB");

  const next = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: root,
    detached: process.platform !== "win32",
    stdio: "inherit",
    env: {
      ...process.env,
      APP_ORIGIN: `http://127.0.0.1:${appPort}`,
      INVITE_EMAIL_PROVIDER: "mailpit",
      INVITE_EMAIL_FROM: process.env.INVITE_EMAIL_FROM || "Stakeout <invites@stakeout.local>",
      MAILPIT_SMTP_HOST: "127.0.0.1",
      MAILPIT_SMTP_PORT: "54325",
      MONGODB_URI: `mongodb://127.0.0.1:${mongoPort}/stakeout`,
      NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
      ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@example.test",
    },
  });
  children.push(next);
  await waitForLogin(next);

  console.log("\nStakeout is ready:");
  console.log(`  App:     http://127.0.0.1:${appPort}/login`);
  console.log("  Mailpit: http://127.0.0.1:54324");
  console.log("Press Ctrl+C to stop Next.js and MongoDB.");

  for (const child of children) child.on("exit", code => {
    if (!stopping) {
      console.error(`A local service exited unexpectedly (code ${code ?? "unknown"}).`);
      stop(code || 1);
    }
  });
} catch (error) {
  console.error(`\nLocal startup failed: ${error instanceof Error ? error.message : error}`);
  stop(1);
}
