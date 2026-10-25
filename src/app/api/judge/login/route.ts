import { NextRequest, NextResponse } from "next/server";
import { JUDGE_PIN, getExpectedJudgeToken } from "@/lib/judgeAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin } = body;

    if (pin && typeof pin === "string" && pin.trim() === JUDGE_PIN.trim()) {
      const response = NextResponse.json({
        success: true,
        message: "Judge authentication granted.",
      });

      response.cookies.set("judge_token", getExpectedJudgeToken(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });

      return response;
    }

    return NextResponse.json(
      { error: "Invalid Judge Passcode PIN." },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Authentication error", details: err.message },
      { status: 500 }
    );
  }
}
