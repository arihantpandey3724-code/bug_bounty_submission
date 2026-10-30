const { sql } = require('../src/lib/neonClient');

async function test() {
  console.log('Testing neonClient sql import from src/lib/neonClient...');
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
    console.log('Got rawTreasures:', rawTreasures.length);
    console.log('Claimed count:', rawTreasures.filter(t => t.isClaimed).length);
    console.log('First 2:', rawTreasures.slice(0, 2));
  } catch (err) {
    console.error('Error with neonClient sql:', err);
  }
}
test();
