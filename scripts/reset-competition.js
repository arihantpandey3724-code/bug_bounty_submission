const { neon } = require("@neondatabase/serverless");

const DATABASE_URL = "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const sql = neon(DATABASE_URL);

  console.log("Cleaning test records from Neon PostgreSQL...");
  await sql`DELETE FROM "RegularSubmission";`;
  await sql`DELETE FROM "Team";`;
  await sql`UPDATE "MasterBug" SET "isFirstFound" = false, "firstFoundById" = NULL;`;
  await sql`UPDATE "TreasureBug" SET "isClaimed" = false, "claimedByTeamId" = NULL, "claimedAt" = NULL;`;
  await sql`UPDATE "MilestoneTracker" SET "awardedToTeamId" = NULL, "awardedAt" = NULL WHERE "id" = 1;`;

  console.log("Competition state is 100% clean and ready for event start!");
  const teamCount = await sql`SELECT count(*)::int FROM "Team";`;
  const subCount = await sql`SELECT count(*)::int FROM "RegularSubmission";`;
  console.log("Teams:", teamCount[0].count, "| Submissions:", subCount[0].count);
}

main().catch(console.error);
