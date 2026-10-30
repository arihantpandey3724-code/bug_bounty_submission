const { sql } = require("../src/lib/neonClient");

async function test() {
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
    console.log("NeonClient result:", rawTreasures);
  } catch (err) {
    console.error("NeonClient caught error:", err);
  }
}

test();
