/**
 * Cleanup script to remove simulated test teams (SIM-Team-*) and their test submissions
 * Usage: node scripts/cleanup-simulation.js
 */

const { neon } = require("@neondatabase/serverless");
const fs = require("fs");
const path = require("path");

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  try {
    const envContent = fs.readFileSync(path.join(__dirname, "../.env"), "utf8");
    const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
    if (match) connectionString = match[1];
  } catch {}
}
if (!connectionString) {
  connectionString = "postgresql://neondb_owner:npg_1bK6IovrOQhZ@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";
}
const sql = neon(connectionString);

async function cleanup() {
  console.log("🧹 Cleaning up simulation data (SIM-* teams and submissions)...");

  try {
    // 1. Delete submissions from SIM teams
    const deletedSubs = await sql`
      DELETE FROM "RegularSubmission"
      WHERE "teamId" IN (
        SELECT id FROM "Team"
        WHERE name LIKE 'SIM%' OR email LIKE '%entropy.test%' OR name LIKE '%Typo%'
      )
      RETURNING id;
    `;
    console.log(`Deleted ${deletedSubs.length} simulated bug submission(s).`);

    // 2. Clear any claimed treasures by SIM teams
    await sql`
      UPDATE "TreasureBug"
      SET "isClaimed" = false, "claimedByTeamId" = NULL, "claimedAt" = NULL
      WHERE "claimedByTeamId" IN (
        SELECT id FROM "Team"
        WHERE name LIKE 'SIM%' OR email LIKE '%entropy.test%' OR name LIKE '%Typo%'
      );
    `;

    // 3. Delete SIM teams
    const deletedTeams = await sql`
      DELETE FROM "Team"
      WHERE name LIKE 'SIM%' OR email LIKE '%entropy.test%' OR name LIKE '%Typo%'
      RETURNING id, name;
    `;
    console.log(`Deleted ${deletedTeams.length} simulated team(s).`);

    console.log("✅ Simulation data cleanup complete! Database is clean.");
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}

cleanup();
