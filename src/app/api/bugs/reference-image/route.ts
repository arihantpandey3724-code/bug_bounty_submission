import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isJudgeAuthorized } from "@/lib/judgeAuth";

export const dynamic = "force-dynamic";

const REF_DIR = path.join(process.cwd(), "data", "reference_screenshots");

function ensureRefDir() {
  if (!fs.existsSync(REF_DIR)) {
    fs.mkdirSync(REF_DIR, { recursive: true });
  }
}

export async function GET(req: NextRequest) {
  ensureRefDir();
  const { searchParams } = new URL(req.url);
  const bugId = searchParams.get("bugId");

  if (bugId) {
    const filePath = path.join(REF_DIR, `${bugId.toUpperCase()}.png`);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const base64 = `data:image/png;base64,${buffer.toString("base64")}`;
      return NextResponse.json({ bugId: bugId.toUpperCase(), hasImage: true, imageUrl: base64 });
    }
    return NextResponse.json({ bugId: bugId.toUpperCase(), hasImage: false });
  }

  // List all bug IDs that currently have reference images
  try {
    const files = fs.readdirSync(REF_DIR);
    const available = files
      .filter((f) => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".webp"))
      .map((f) => path.parse(f).name.toUpperCase());

    return NextResponse.json({ availableBugImages: available });
  } catch (err: any) {
    return NextResponse.json({ availableBugImages: [], error: err.message });
  }
}

export async function POST(req: NextRequest) {
  if (!isJudgeAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Judge authentication required to upload reference screenshots." },
      { status: 401 }
    );
  }

  ensureRefDir();
  try {
    const body = await req.json();
    const { bugId, imageBase64 } = body;

    if (!bugId || !imageBase64) {
      return NextResponse.json(
        { error: "bugId and imageBase64 are required" },
        { status: 400 }
      );
    }

    const cleanBugId = bugId.toUpperCase().trim();
    const parts = imageBase64.split(",");
    const rawData = parts.length > 1 ? parts[1] : parts[0];
    const buffer = Buffer.from(rawData, "base64");

    const filePath = path.join(REF_DIR, `${cleanBugId}.png`);
    fs.writeFileSync(filePath, buffer);

    console.log(`[reference-image] Saved reference screenshot for ${cleanBugId}`);
    return NextResponse.json({
      success: true,
      bugId: cleanBugId,
      message: `Reference screenshot saved for Master Bug [${cleanBugId}]. AI will now use this for visual similarity checks.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to save reference screenshot", details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!isJudgeAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Judge authentication required." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const bugId = searchParams.get("bugId");
  if (!bugId) {
    return NextResponse.json({ error: "bugId is required" }, { status: 400 });
  }

  const filePath = path.join(REF_DIR, `${bugId.toUpperCase()}.png`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true, message: `Removed reference screenshot for ${bugId}` });
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}
