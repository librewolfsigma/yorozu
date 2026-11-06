import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api-utils";
import { runSync } from "@/lib/sync";

// Manual sync trigger: POST /api/sync/run  body: { job?: "health"|"crosswalk"|"all" }
export async function POST(req: NextRequest) {
  return handle(async () => {
    let which: "health" | "crosswalk" | "all" = "all";
    try {
      const body = (await req.json()) as { job?: "health" | "crosswalk" | "all" };
      if (body?.job === "health" || body?.job === "crosswalk" || body?.job === "all") which = body.job;
    } catch {
      // empty body → "all"
    }
    const reports = await runSync(which);
    return NextResponse.json({ ok: reports.every((r) => r.ok), reports });
  });
}
