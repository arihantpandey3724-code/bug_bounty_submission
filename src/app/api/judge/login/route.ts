import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin } = body;

    const validPin = process.env.JUDGE_PIN || "laal_wala_AngryBird";

    if (pin === validPin) {
      const response = NextResponse.json({
        success: true,
        message: "Judge authentication granted.",
      });

      response.cookies.set("judge_token", "entropy-judge-authorized", {
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
