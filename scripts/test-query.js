const { neon } = require("@neondatabase/serverless");

const connectionString = "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(connectionString);

async function run() {
  try {
    const rawTreasures = await sql`
      SELECT 
        tr.id, 
        tr.code, 
        tr."isClaimed", 
        tr."claimedByTeamId", 
        tr."claimedAt",
        case when t.id is not null then json_build_object('id', t.id, 'name', t.name) else null end as "claimedByTeam"
      FROM "TreasureBug" tr
      LEFT JOIN "Team" t ON t.id = tr."claimedByTeamId"
      ORDER BY tr.id ASC;
    `;
    console.log("SQL QUERY RESULT:");
    console.log(rawTreasures);
  } catch (err) {
    console.error("SQL ERROR:", err);
  }
}

run();
