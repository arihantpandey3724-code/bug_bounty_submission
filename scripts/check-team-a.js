const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require');

async function test() {
  const teamA = await sql`SELECT * FROM "Team" WHERE name = 'a';`;
  console.log('Team with exact name a:', teamA);
  const subsA = await sql`SELECT * FROM "RegularSubmission" WHERE "teamId" IN (SELECT id FROM "Team" WHERE name = 'a');`;
  console.log('Submissions for team a:', subsA);
}

test().catch(console.error);
