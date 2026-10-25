import crypto from "crypto";
import { NextRequest } from "next/server";

export const JUDGE_PIN = process.env.JUDGE_PIN || "laal_wala_AngryBird";
const JUDGE_SECRET = process.env.JUDGE_SECRET || "entropy-2k26-judge-hmac-salt-key-998811";

/**
 * Deterministically generates an HMAC session token derived from the judge PIN and server salt.
 * Cannot be forged or guessed by clients.
 */
export function getExpectedJudgeToken(): string {
  return crypto
    .createHmac("sha256", JUDGE_SECRET)
    .update(`${JUDGE_PIN.trim()}_entropy_judge_authorized`)
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
  if (authHeader && authHeader.trim() === JUDGE_PIN.trim()) {
    return true;
  }

  // 3. Authorization Bearer header
  const authBearer = req.headers.get("authorization");
  if (authBearer && authBearer.trim() === `Bearer ${JUDGE_PIN.trim()}`) {
    return true;
  }

  return false;
}
