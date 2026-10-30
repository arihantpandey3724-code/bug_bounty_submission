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

const cleanUrl = connectionString
  .replace("-pooler", "")
  .replace(/&pgbouncer=true/g, "")
  .replace(/\?pgbouncer=true&/g, "?")
  .replace(/\?pgbouncer=true/g, "");

const sql = neon(cleanUrl);

async function run() {
  console.log("--- LIVE DB AUDIT ---");
  const treasures = await sql`SELECT id, code, "isClaimed", "claimedByTeamId", "claimedAt" FROM "TreasureBug" ORDER BY id ASC;`;
  console.log("Treasures count:", treasures.length);
  console.log("Claimed treasures:", treasures.filter(t => t.isClaimed));

  const topTeams = await sql`SELECT id, name, "totalScore", "validBugsCount" FROM "Team" ORDER BY "totalScore" DESC LIMIT 5;`;
  console.log("Top Teams:", topTeams);

  const team27 = await sql`SELECT id, name, "totalScore", "validBugsCount" FROM "Team" WHERE name LIKE '%27%' LIMIT 2;`;
  console.log("Team 27:", team27);

  const milestone = await sql`SELECT * FROM "MilestoneTracker";`;
  console.log("Milestone:", milestone);
}

run().catch(console.error);
