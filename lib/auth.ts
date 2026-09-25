import "server-only";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "admin_session";
const SESSION_TTL = "7d";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET env var");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "superadmin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  return (await readSessionToken(token))?.role === "superadmin";
}

export type SessionIdentity = { role: "superadmin" } | { role: "club_staff"; staffId: string };

export async function createStaffSessionToken(staffId: string): Promise<string> {
  return new SignJWT({ role: "club_staff" })
    .setSubject(staffId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecretKey());
}

export async function readSessionToken(token: string): Promise<SessionIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    if (payload.role === "superadmin") return { role: "superadmin" };
    if (payload.role === "club_staff" && payload.sub) return { role: "club_staff", staffId: payload.sub };
    return null;
  } catch {
    return null;
  }
}
