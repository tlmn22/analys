import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/** Salted scrypt hash, stored as "salt:hash" (both hex) — no extra
 * dependency needed (bcrypt/argon2 both require native bindings, which are
 * a pain on Windows); Node's built-in scrypt is a solid, dependency-free
 * choice for this. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hashHex] = storedHash.split(":");
  if (!salt || !hashHex) return false;
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const stored = Buffer.from(hashHex, "hex");
  if (derived.length !== stored.length) return false;
  return timingSafeEqual(derived, stored);
}
