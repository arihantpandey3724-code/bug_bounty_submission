const { neon } = require("@neondatabase/serverless");

const DATABASE_URL = "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const sql = neon(DATABASE_URL);
  const teams = await sql`SELECT * FROM "Team";`;
  console.log("Teams in Neon DB:", teams);
  const subs = await sql`SELECT * FROM "RegularSubmission";`;
  console.log("Submissions in Neon DB:", subs);
}

main().catch(console.error);
