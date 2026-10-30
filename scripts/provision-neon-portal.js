const { neon } = require("@neondatabase/serverless");
const { MASTER_BUGS, INITIAL_TREASURES, DEMO_TEAMS } = require("../src/config/masterBugs");

const DATABASE_URL =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  console.log("Connecting to Neon over HTTPS port 443...");
  const sql = neon(DATABASE_URL);

  console.log("1. Creating tables in Neon PostgreSQL...");

  // 1. Team Table
  await sql`
    CREATE TABLE IF NOT EXISTS "Team" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT UNIQUE NOT NULL,
      "email" TEXT UNIQUE NOT NULL,
      "totalScore" INTEGER NOT NULL DEFAULT 0,
      "validBugsCount" INTEGER NOT NULL DEFAULT 0,
      "hasMilestoneBonus" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS "Team_totalScore_idx" ON "Team" ("totalScore" DESC);`;

  // 2. MasterBug Table
  await sql`
    CREATE TABLE IF NOT EXISTS "MasterBug" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "basePoints" INTEGER NOT NULL,
      "speedBonusPoints" INTEGER NOT NULL,
      "expected" TEXT NOT NULL,
      "actual" TEXT NOT NULL,
      "location" TEXT NOT NULL,
      "isFirstFound" BOOLEAN NOT NULL DEFAULT false,
      "firstFoundById" TEXT
    );
  `;

  // 3. RegularSubmission Table
  await sql`
    CREATE TABLE IF NOT EXISTS "RegularSubmission" (
      "id" TEXT PRIMARY KEY,
      "teamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
      "description" TEXT,
      "codeSnippet" TEXT,
      "screenshotUrl" TEXT,
      "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
      "matchedBugId" TEXT REFERENCES "MasterBug"("id"),
      "awardedPoints" INTEGER NOT NULL DEFAULT 0,
      "isSpeedBonus" BOOLEAN NOT NULL DEFAULT false,
      "llmConfidence" DOUBLE PRECISION,
      "llmReasoning" TEXT,
      "judgeOverride" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS "RegularSubmission_teamId_idx" ON "RegularSubmission" ("teamId");`;
  await sql`CREATE INDEX IF NOT EXISTS "RegularSubmission_status_idx" ON "RegularSubmission" ("status");`;
  await sql`CREATE INDEX IF NOT EXISTS "RegularSubmission_matchedBugId_idx" ON "RegularSubmission" ("matchedBugId");`;
  await sql`CREATE INDEX IF NOT EXISTS "RegularSubmission_createdAt_idx" ON "RegularSubmission" ("createdAt");`;

  // 4. TreasureBug Table
  await sql`
    CREATE TABLE IF NOT EXISTS "TreasureBug" (
      "id" INTEGER PRIMARY KEY,
      "code" TEXT UNIQUE NOT NULL,
      "isClaimed" BOOLEAN NOT NULL DEFAULT false,
      "claimedByTeamId" TEXT REFERENCES "Team"("id"),
      "claimedAt" TIMESTAMP(3)
    );
  `;

  // 5. MilestoneTracker Table
  await sql`
    CREATE TABLE IF NOT EXISTS "MilestoneTracker" (
      "id" INTEGER PRIMARY KEY DEFAULT 1,
      "awardedToTeamId" TEXT,
      "awardedAt" TIMESTAMP(3)
    );
  `;

  console.log("2. Tables created successfully. Seeding 54 Master Bugs...");
  for (const b of MASTER_BUGS) {
    await sql`
      INSERT INTO "MasterBug" ("id", "title", "category", "basePoints", "speedBonusPoints", "expected", "actual", "location", "isFirstFound")
      VALUES (${b.id}, ${b.title}, ${b.category}, ${b.basePoints}, ${b.speedBonusPoints}, ${b.expected}, ${b.actual}, ${b.location}, false)
      ON CONFLICT ("id") DO UPDATE SET
        "title" = ${b.title},
        "category" = ${b.category},
        "basePoints" = ${b.basePoints},
        "speedBonusPoints" = ${b.speedBonusPoints},
        "expected" = ${b.expected},
        "actual" = ${b.actual},
        "location" = ${b.location};
    `;
  }
  console.log(`Seeded ${MASTER_BUGS.length} Master Bugs.`);

  console.log("3. Seeding 10 Treasure Bug slots...");
  for (const t of INITIAL_TREASURES) {
    await sql`
      INSERT INTO "TreasureBug" ("id", "code", "isClaimed")
      VALUES (${t.id}, ${t.code}, false)
      ON CONFLICT ("id") DO UPDATE SET
        "code" = ${t.code};
    `;
  }
  console.log("Seeded 10 Treasure Bugs.");

  console.log("4. Seeding Milestone Tracker...");
  await sql`
    INSERT INTO "MilestoneTracker" ("id", "awardedToTeamId", "awardedAt")
    VALUES (1, NULL, NULL)
    ON CONFLICT ("id") DO NOTHING;
  `;

  console.log("5. Seeding Demo Teams if configured...");
  for (const team of DEMO_TEAMS) {
    await sql`
      INSERT INTO "Team" ("id", "name", "email", "totalScore", "validBugsCount", "hasMilestoneBonus")
      VALUES (${'team-' + Math.random().toString(36).slice(2, 8)}, ${team.name}, ${team.email}, 0, 0, false)
      ON CONFLICT ("name") DO NOTHING;
    `;
  }

  const teamCount = await sql`SELECT count(*)::int FROM "Team";`;
  const bugCount = await sql`SELECT count(*)::int FROM "MasterBug";`;
  const treasureCount = await sql`SELECT count(*)::int FROM "TreasureBug";`;

  console.log("\n==============================================");
  console.log("  PROVISIONING COMPLETE ON NEON POSTGRESQL!   ");
  console.log("==============================================");
  console.log("Teams in DB         :", teamCount[0].count);
  console.log("Master Bugs in DB   :", bugCount[0].count);
  console.log("Treasure Bugs in DB :", treasureCount[0].count);
  console.log("==============================================\n");
}

main().catch(console.error);
