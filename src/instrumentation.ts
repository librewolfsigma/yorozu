// Next.js instrumentation hook.
//
// Yozora's product runtime is the seanime fork server (Go) — see
// src/lib/seanime-runtime.ts. This hook starts it as a detached child of the
// Next.js process and keeps it alive for the lifetime of the dev server.
// (The legacy v2 client-first architecture note is superseded by the seanime
// pivot; no catalog syncing happens here — the Go server owns user data.)
import { ensureSeanimeServer, registerSeanimeKeepalive } from "@/lib/seanime-runtime";

export async function register() {
  registerSeanimeKeepalive();
  void ensureSeanimeServer().catch((e) =>
    console.error("[yozora-runtime] boot error", e),
  );
}
