const { neon } = require("@neondatabase/serverless");
const sql = neon("postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require");
async function check() {
  const res = await sql`SELECT id, title, expected, actual FROM "MasterBug" WHERE id = 'MED-10';`;
  console.log("MED-10 in DB:", res[0]);
}
check();
