const { neon } = require("@neondatabase/serverless");
const { MASTER_BUGS } = require("../src/config/masterBugs");

const DATABASE_URL =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  console.log("Connecting to Neon to upsert master bugs...");
  const sql = neon(DATABASE_URL);

  let inserted = 0;
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
    inserted++;
  }

  const bugCount = await sql`SELECT count(*)::int FROM "MasterBug";`;
  console.log(`Successfully synced ${inserted} Master Bugs. Total in Neon DB: ${bugCount[0].count}`);

  const checkBugs = await sql`SELECT id, title, category, "basePoints" FROM "MasterBug" WHERE id IN ('EASY-19', 'MED-22');`;
  console.log("Newly added bugs verification:", checkBugs);
}

main().catch(console.error);
