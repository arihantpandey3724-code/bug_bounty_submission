const { neon } = require("@neondatabase/serverless");

const DATABASE_URL = "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const sql = neon(DATABASE_URL);
  const t0 = Date.now();
  
  // Find a team
  const teams = await sql`SELECT id FROM "Team" LIMIT 1;`;
  if (teams.length === 0) {
    console.log("No teams");
    return;
  }
  const teamId = teams[0].id;
  const subId = `sub-${Date.now()}`;
  
  await sql`
    INSERT INTO "RegularSubmission" (
      "id", "teamId", "description", "codeSnippet", "screenshotUrl", 
      "status", "matchedBugId", "llmConfidence", "llmReasoning", 
      "awardedPoints", "isSpeedBonus", "createdAt"
    ) VALUES (
      ${subId}, ${teamId}, 'Test description from neon HTTP', '// test code', NULL,
      'UNVERIFIED', 'EASY-01', 0.95, 'High confidence match',
      0, false, NOW()
    );
  `;
  console.log(`Insert succeeded in ${Date.now() - t0}ms!`);

  const subs = await sql`SELECT * FROM "RegularSubmission" WHERE id = ${subId};`;
  console.log("Verified inserted submission:", subs[0].id, subs[0].description);
  
  // Clean up
  await sql`DELETE FROM "RegularSubmission" WHERE id = ${subId};`;
  console.log("Cleaned up test sub");
}

main().catch(console.error);
