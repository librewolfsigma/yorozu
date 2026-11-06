import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, setAgeVerified, verifyPassword } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";
import { serializeUser } from "@/lib/serialize";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<{ username?: string; password?: string }>(req);
    const username = (body.username ?? "").trim().toLowerCase();
    const user = await db.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(body.password ?? "", user.passwordHash)) {
      throw new ApiError(401, "Invalid username or password.");
    }
    await createSession(user.id);
    await setAgeVerified();
    return NextResponse.json({ user: serializeUser(user) });
  });
}
