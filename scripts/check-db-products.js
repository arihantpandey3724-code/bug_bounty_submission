const { neon } = require("@neondatabase/serverless");

const DATABASE_URL = "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const sql = neon(DATABASE_URL);
  try {
    const rows = await sql`SELECT "id", "title" FROM "Product" LIMIT 5;`;
    console.log("Neon DB Products:", rows);
  } catch (e) {
    console.log("No Product table or query note:", e.message);
  }
}

main().catch(console.error);
