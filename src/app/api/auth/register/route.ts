import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword, setAgeVerified } from "@/lib/auth";
import { handle, readJson, ApiError } from "@/lib/api-utils";
import { avatarUrl } from "@/lib/content-factory";
import { serializeUser } from "@/lib/serialize";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<{ username?: string; password?: string; displayName?: string }>(req);
    const username = (body.username ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      throw new ApiError(400, "Username must be 3–24 chars (a-z, 0-9, _).");
    }
    if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters.");
    const existing = await db.user.findUnique({ where: { username } });
    if (existing) throw new ApiError(409, "Username already taken.");

    const user = await db.user.create({
      data: {
        username,
        displayName: body.displayName?.slice(0, 40) || username,
        passwordHash: hashPassword(password),
        avatarUrl: avatarUrl(username, username.slice(0, 1)),
        ageVerifiedAt: new Date(),
      },
    });
    await createSession(user.id);
    await setAgeVerified();
    await db.notification.create({
      data: { userId: user.id, type: "INFO", title: "Welcome to Yozora", body: "Your universal 18+ media platform. Explore categories or install more providers.", link: "#/browse/ANIME" },
    });
    return NextResponse.json({ user: serializeUser(user) });
  });
}
