import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let storefrontBaseUrl = "";
  try {
    let bodyUrl = "";
    try {
      const body = await req.json();
      bodyUrl = body?.storefrontUrl || "";
    } catch {}

    storefrontBaseUrl =
      bodyUrl ||
      process.env.STOREFRONT_URL ||
      process.env.NEXT_PUBLIC_STOREFRONT_URL ||
      "http://localhost:3000";

    const targetUrl = `${storefrontBaseUrl.replace(/\/$/, "")}/api/admin/reset`;

    console.log(`[Judge Console] Forwarding reset request to storefront: ${targetUrl}`);

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[Judge Console] Storefront reset forwarding error:", error);
    return NextResponse.json(
      {
        error: "Failed to connect to Amazon storefront",
        details: error.message,
        targetTried: storefrontBaseUrl,
      },
      { status: 502 }
    );
  }
}
