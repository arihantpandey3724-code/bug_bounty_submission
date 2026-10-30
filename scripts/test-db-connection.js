const { neon } = require("@neondatabase/serverless");

const DATABASE_URL = "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const sql = neon(DATABASE_URL);
  const t0 = Date.now();
  const res = await sql`SELECT count(*)::int as count FROM "Team";`;
  console.log("NEON SERVERLESS QUERY SUCCESS in " + (Date.now() - t0) + "ms. Teams: " + res[0].count);
}

main().catch(console.error);
