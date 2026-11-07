import { cookies } from "next/headers";
import crypto from "node:crypto";
import { db } from "./db";

const SESSION_COOKIE = "yozora_session";
const AGE_COOKIE = "yozora_age_ok";
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({ data: { token, userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (session) {
      if (session.expiresAt.getTime() > Date.now()) return session.user;
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
    }
  }
  // Yozora has NO login — every visitor transparently continues as this
  // device's local profile. Nothing is gated, nothing is asked.
  return ensureLocalSession(jar);
}

const LOCAL_USERNAME = "local";

async function ensureLocalSession(jar: Awaited<ReturnType<typeof cookies>>) {
  let user = await db.user.findUnique({ where: { username: LOCAL_USERNAME } });
  if (!user) {
    user = await db.user
      .create({
        data: {
          username: LOCAL_USERNAME,
          displayName: "Local viewer",
          // Unusable random secret — no password login exists in Yozora.
          passwordHash: crypto.randomBytes(32).toString("hex"),
          isDemo: true,
        },
      })
      .catch(() => db.user.findUnique({ where: { username: LOCAL_USERNAME } })); // concurrent-create race
  }
  if (!user) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 365 * 86400_000);
  await db.session.create({ data: { token, userId: user.id, expiresAt } });
  try {
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
  } catch {
    // Cookie writes are only permitted inside route handlers/server actions.
    // In RSC render contexts this is a no-op — the request still resolves.
  }
  return user;
}

export async function isAgeVerified(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(AGE_COOKIE)?.value === "1";
}

export async function setAgeVerified(): Promise<void> {
  const jar = await cookies();
  jar.set(AGE_COOKIE, "1", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
