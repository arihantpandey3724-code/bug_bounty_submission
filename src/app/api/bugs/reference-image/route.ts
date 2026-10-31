import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { sql } from "@/lib/neonClient";
import { isJudgeAuthorized } from "@/lib/judgeAuth";

export const dynamic = "force-dynamic";

const REF_DIR = path.join(process.cwd(), "data", "reference_screenshots");

function ensureRefDir() {
  try {
    if (!fs.existsSync(REF_DIR)) {
      fs.mkdirSync(REF_DIR, { recursive: true });
    }
  } catch {
    // Read-only filesystem in serverless environments (e.g. Vercel)
  }
}

export async function GET(req: NextRequest) {
  if (!isJudgeAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: Judge authentication required to view reference screenshots." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const bugId = searchParams.get("bugId");

  if (bugId) {
    const cleanBugId = bugId.toUpperCase().trim();
    // 1. Try DB first (works on Vercel & across instances)
    try {
      const rows = await sql`
        SELECT "bugId", "imageBase64"
        FROM "BugReferenceImage"
        WHERE "bugId" = ${cleanBugId}
        LIMIT 1;
      `;
      if (rows.length > 0) {
        return NextResponse.json({
          bugId: cleanBugId,
          hasImage: true,
          imageUrl: rows[0].imageBase64,
        });
      }
    } catch (dbErr: any) {
      console.warn("[reference-image GET] DB lookup notice:", dbErr.message);
    }

    // 2. Try filesystem fallback
    try {
      const filePath = path.join(REF_DIR, `${cleanBugId}.png`);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const base64 = `data:image/png;base64,${buffer.toString("base64")}`;
        return NextResponse.json({ bugId: cleanBugId, hasImage: true, imageUrl: base64 });
      }
    } catch {}

    return NextResponse.json({ bugId: cleanBugId, hasImage: false });
  }

  // List all bug IDs that currently have reference images
  try {
    const available = new Set<string>();

    // 1. From database
    try {
      const rows = await sql`
        SELECT "bugId" FROM "BugReferenceImage";
      `;
      for (const r of rows) {
        available.add(r.bugId.toUpperCase());
      }
    } catch (e: any) {
      console.warn("[reference-image GET all] DB list notice:", e.message);
    }

    // 2. From filesystem
    try {
      if (fs.existsSync(REF_DIR)) {
        const files = fs.readdirSync(REF_DIR);
        files
          .filter((f) => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".webp"))
          .forEach((f) => available.add(path.parse(f).name.toUpperCase()));
      }
    } catch {}

    return NextResponse.json({ availableBugImages: Array.from(available) });
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
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";

    // 1. Primary: Store persistently in Neon PostgreSQL (works on Vercel and local)
    await sql`
      CREATE TABLE IF NOT EXISTS "BugReferenceImage" (
        "bugId" VARCHAR(50) PRIMARY KEY,
        "imageBase64" TEXT NOT NULL,
        "mimeType" VARCHAR(50) DEFAULT 'image/png',
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `;

    await sql`
      INSERT INTO "BugReferenceImage" ("bugId", "imageBase64", "mimeType", "updatedAt")
      VALUES (${cleanBugId}, ${imageBase64}, ${mimeType}, NOW())
      ON CONFLICT ("bugId") DO UPDATE
      SET "imageBase64" = EXCLUDED."imageBase64",
          "mimeType" = EXCLUDED."mimeType",
          "updatedAt" = NOW();
    `;

    // 2. Secondary: Best-effort local file write (safely ignored on read-only serverless runtimes)
    try {
      ensureRefDir();
      const rawData = parts.length > 1 ? parts[1] : parts[0];
      const buffer = Buffer.from(rawData, "base64");
      const filePath = path.join(REF_DIR, `${cleanBugId}.png`);
      fs.writeFileSync(filePath, buffer);
    } catch {
      // Ignore read-only filesystem errors on Vercel
    }

    console.log(`[reference-image] Saved reference screenshot for ${cleanBugId} in PostgreSQL.`);
    return NextResponse.json({
      success: true,
      bugId: cleanBugId,
      message: `Reference screenshot saved for Master Bug [${cleanBugId}]. AI will now use this for visual similarity checks.`,
    });
  } catch (err: any) {
    console.error("[reference-image POST] Error saving reference screenshot:", err);
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

  const cleanBugId = bugId.toUpperCase().trim();

  // 1. Delete from PostgreSQL
  try {
    await sql`
      DELETE FROM "BugReferenceImage"
      WHERE "bugId" = ${cleanBugId};
    `;
  } catch (dbErr: any) {
    console.warn("[reference-image DELETE] DB notice:", dbErr.message);
  }

  // 2. Best-effort delete from local file
  try {
    const filePath = path.join(REF_DIR, `${cleanBugId}.png`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}

  return NextResponse.json({ success: true, message: `Removed reference screenshot for ${cleanBugId}` });
}
