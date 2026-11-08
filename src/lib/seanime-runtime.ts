/**
 * Yozora runtime bridge.
 *
 * The Yozora product is the seanime fork (librewolfsigma/yozora — Go server with
 * the embedded web UI, GPL-3.0). In the sandbox, the only process that survives
 * across tool calls is the supervisor-managed Next.js dev server, so the Go
 * server is spawned as a detached child of the Next.js process and reaped
 * responsibly:
 *
 *   - `ensureSeanimeServer()` probes 127.0.0.1:43211 and spawns the binary if
 *     it is not answering, then waits for readiness.
 *   - The bridge-boot API route calls it on demand (hot-reloadable).
 *   - instrumentation.ts registers a periodic keepalive so the server also
 *     comes back after a dev-server restart.
 *
 * The server keeps all state (SQLite, settings, installed extensions) in
 * /home/z/yozora-data, so respawns are lossless.
 */
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";

const SEANIME_HOST = "127.0.0.1";
const SEANIME_PORT = 43211;
// Persisted inside the project so the binary + data survive sandbox recycles.
const RUNTIME_DIR = "/home/z/my-project/.yozora/runtime";
const DATA_DIR = "/home/z/my-project/.yozora/data";
export const SEANIME_BIN = path.join(RUNTIME_DIR, "seanime-server");
export const SEANIME_BASE_URL = `http://${SEANIME_HOST}:${SEANIME_PORT}`;

declare global {
  var __yozoraSeanimeBootingV2: Promise<boolean> | null;
  var __yozoraSeanimeKeepaliveV2: NodeJS.Timeout | null;
}

function probePort(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export async function isSeanimeUp(): Promise<boolean> {
  return probePort(SEANIME_HOST, SEANIME_PORT, 1200);
}

function spawnSeanime(): ChildProcess | null {
  if (!fs.existsSync(SEANIME_BIN)) {
    console.error("[yozora-runtime] seanime-server binary not found at", SEANIME_BIN);
    return null;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const logFd = fs.openSync(path.join(RUNTIME_DIR, "server.log"), "a");
  const child = spawn(
    SEANIME_BIN,
    ["--datadir", DATA_DIR],
    {
      cwd: RUNTIME_DIR,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: { ...process.env, HOME: process.env.HOME ?? "/home/z" },
    },
  );
  child.unref();
  console.log("[yozora-runtime] spawned seanime-server pid=", child.pid);
  return child;
}

/**
 * Make sure the Yozora (seanime) server is running. Safe to call concurrently:
 * a shared in-flight promise prevents double spawns.
 */
export async function ensureSeanimeServer(): Promise<boolean> {
  if (await isSeanimeUp()) return true;

  if (globalThis.__yozoraSeanimeBootingV2) return globalThis.__yozoraSeanimeBootingV2;

  globalThis.__yozoraSeanimeBootingV2 = (async () => {
    try {
      const child = spawnSeanime();
      if (!child) return false;
      // Wait for readiness (first boot migrates the DB, so allow a while).
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 700));
        if (await isSeanimeUp()) return true;
        if (child.exitCode !== null && child.signalCode === null && i > 5) return false;
      }
      return false;
    } finally {
      globalThis.__yozoraSeanimeBootingV2 = null;
    }
  })();

  return globalThis.__yozoraSeanimeBootingV2;
}

/** Register a periodic keepalive inside the Next.js server process. */
export function registerSeanimeKeepalive(intervalMs = 30_000): void {
  if (globalThis.__yozoraSeanimeKeepaliveV2) return;
  globalThis.__yozoraSeanimeKeepaliveV2 = setInterval(() => {
    void ensureSeanimeServer().catch((e) =>
      console.error("[yozora-runtime] keepalive error", e),
    );
  }, intervalMs);
  // Do not hold the event loop open because of the keepalive.
  globalThis.__yozoraSeanimeKeepaliveV2.unref?.();
}
