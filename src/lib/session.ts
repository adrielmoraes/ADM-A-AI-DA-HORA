import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

type SessionPayload = {
  userId: string;
  nome: string;
  cargo: "ADMIN" | "FUNCIONARIO";
  turnoId?: string;
  lastActiveAt?: number;
};

const SESSION_COOKIE = "session";
const DEFAULT_IDLE_MINUTES = 120;
const REFRESH_AFTER_SECONDS = 300;
const IDLE_TIMEOUT_SECONDS = (() => {
  const raw = Number(process.env.SESSION_IDLE_MINUTES);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw * 60);
  return DEFAULT_IDLE_MINUTES * 60;
})();

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload, lastActiveAt: nowSeconds() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, getSecret());
    const payload = verified.payload as unknown as SessionPayload;
    if (!payload?.userId || !payload?.cargo) return null;
    const now = nowSeconds();
    const lastActiveAt = typeof payload.lastActiveAt === "number" ? payload.lastActiveAt : now;
    if (now - lastActiveAt > IDLE_TIMEOUT_SECONDS) {
      await clearSession();
      return null;
    }
    if (now - lastActiveAt >= REFRESH_AFTER_SECONDS) {
      await createSession({
        userId: payload.userId,
        nome: payload.nome,
        cargo: payload.cargo,
        turnoId: payload.turnoId,
        lastActiveAt: now,
      });
      return { ...payload, lastActiveAt: now };
    }
    return { ...payload, lastActiveAt };
  } catch {
    return null;
  }
}
