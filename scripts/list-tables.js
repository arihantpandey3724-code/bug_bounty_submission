const { neon } = require("@neondatabase/serverless");

const DATABASE_URL = "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const sql = neon(DATABASE_URL);
  const tables = await sql`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `;
  console.log("Tables in public schema:", tables);
}

main().catch(console.error);
