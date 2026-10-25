import { NextRequest } from "next/server";

export const JUDGE_PIN = process.env.JUDGE_PIN || "laal_wala_AngryBird";
export const JUDGE_COOKIE_TOKEN = "entropy-judge-authorized";

export function isJudgeAuthorized(req: NextRequest): boolean {
  // 1. Check HTTP-only cookie
  const cookie = req.cookies.get("judge_token")?.value;
  if (cookie === JUDGE_COOKIE_TOKEN) return true;

  // 2. Check x-judge-auth header
  const authHeader = req.headers.get("x-judge-auth");
  if (authHeader === JUDGE_PIN) return true;

  // 3. Check Authorization Bearer header
  const authBearer = req.headers.get("authorization");
  if (authBearer === `Bearer ${JUDGE_PIN}`) return true;

  return false;
}
