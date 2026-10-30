const { neon } = require("@neondatabase/serverless");

const DATABASE_URL = "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const sql = neon(DATABASE_URL);
  const teams = await sql`SELECT "id", "name", "totalScore", "validBugsCount" FROM "Team" ORDER BY "totalScore" DESC;`;
  console.log("Teams in DB:", teams);

  const subs = await sql`SELECT "id", "teamId", "status", "awardedPoints", "createdAt" FROM "RegularSubmission" ORDER BY "createdAt" DESC LIMIT 10;`;
  console.log("Submissions in DB:", subs);
}

main().catch(console.error);
