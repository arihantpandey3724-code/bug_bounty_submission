import crypto from "crypto";
import { NextRequest } from "next/server";

export const DEFAULT_JUDGE_PIN = "laal_wala_AngryBird";
export const JUDGE_PIN = process.env.JUDGE_PIN || DEFAULT_JUDGE_PIN;
const JUDGE_SECRET = process.env.JUDGE_SECRET || "entropy-2k26-judge-hmac-salt-key-998811";

/**
 * Validates PIN against both the canonical PIN and any env override.
 * Cleans surrounding whitespace and quotes for robustness.
 */
export function isPinValid(pin?: string | null): boolean {
  if (!pin || typeof pin !== "string") return false;
  const cleanInput = pin.trim().replace(/^["']|["']$/g, "");
  const envPin = (process.env.JUDGE_PIN || "").trim().replace(/^["']|["']$/g, "");
  return cleanInput === DEFAULT_JUDGE_PIN || (Boolean(envPin) && cleanInput === envPin);
}

/**
 * Deterministically generates an HMAC session token derived from the judge PIN and server salt.
 * Cannot be forged or guessed by clients.
 */
export function getExpectedJudgeToken(): string {
  return crypto
    .createHmac("sha256", JUDGE_SECRET)
    .update(`${DEFAULT_JUDGE_PIN}_entropy_judge_authorized`)
    .digest("hex");
}

/**
 * Server-side check validating a raw cookie token string.
 */
export function isJudgeAuthorizedServer(cookieToken?: string | null): boolean {
  if (!cookieToken) return false;
  return cookieToken === getExpectedJudgeToken();
}

/**
 * Multi-layer request validator for API route handlers.
 */
export function isJudgeAuthorized(req: NextRequest): boolean {
  // 1. Check HTTP-only cookie
  const cookieToken = req.cookies.get("judge_token")?.value;
  if (cookieToken && isJudgeAuthorizedServer(cookieToken)) {
    return true;
  }

  // 2. Direct Header Check (for secure curl / admin CLI calls with exact PIN)
  const authHeader = req.headers.get("x-judge-auth");
  if (authHeader && isPinValid(authHeader)) {
    return true;
  }

  // 3. Authorization Bearer header
  const authBearer = req.headers.get("authorization");
  if (authBearer) {
    const token = authBearer.replace(/^Bearer\s+/i, "");
    if (isPinValid(token)) return true;
  }

  return false;
}
