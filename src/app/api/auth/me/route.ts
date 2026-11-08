import { NextResponse } from "next/server";
import { getCurrentUser, isAgeVerified } from "@/lib/auth";
import { handle } from "@/lib/api-utils";
import { serializeUser } from "@/lib/serialize";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    const ageVerified = await isAgeVerified();
    return NextResponse.json({ user: user ? serializeUser(user) : null, ageVerified });
  });
}
