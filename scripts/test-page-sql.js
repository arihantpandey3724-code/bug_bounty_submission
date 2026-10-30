const { neon } = require("@neondatabase/serverless");

const connectionString = "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(connectionString);

async function run() {
  try {
    const [subStats, claimedTreasuresRes, leaderRes] = await Promise.all([
      sql`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE status = 'VERIFIED')::int as verified FROM "RegularSubmission"`,
      sql`SELECT COUNT(*)::int as claimed FROM "TreasureBug" WHERE "isClaimed" = true`,
      sql`SELECT name, "totalScore" FROM "Team" ORDER BY "totalScore" DESC LIMIT 1`,
    ]);
    console.log("subStats:", subStats);
    console.log("claimedTreasuresRes:", claimedTreasuresRes);
    console.log("leaderRes:", leaderRes);
  } catch (err) {
    console.error("PAGE SQL THREW ERROR:", err);
  }
}

run();
