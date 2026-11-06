import { NextResponse } from "next/server";
import { setAgeVerified } from "@/lib/auth";
import { handle } from "@/lib/api-utils";

export async function POST() {
  return handle(async () => {
    await setAgeVerified();
    return NextResponse.json({ ok: true });
  });
}
