import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, setAgeVerified } from "@/lib/auth";
import { handle } from "@/lib/api-utils";
import { avatarUrl } from "@/lib/content-factory";
import { serializeUser } from "@/lib/serialize";

// One-click demo login — creates or reuses the "demo" account.
export async function POST() {
  return handle(async () => {
    let user = await db.user.findUnique({ where: { username: "demo" } });
    if (!user) {
      user = await db.user.create({
        data: {
          username: "demo",
          displayName: "Demo Reader",
          passwordHash: "demo:no-password-login",
          avatarUrl: avatarUrl("demo", "D"),
          bio: "Shared demo account for trying Yozora.",
          ageVerifiedAt: new Date(),
          isDemo: true,
        },
      });
    }
    await createSession(user.id);
    await setAgeVerified();
    return NextResponse.json({ user: serializeUser(user) });
  });
}
