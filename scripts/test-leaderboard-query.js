const { neon } = require("@neondatabase/serverless");

const DATABASE_URL = "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const sql = neon(DATABASE_URL);
  const t0 = Date.now();
  const teams = await sql`
    SELECT 
      t.id, t.name, t.email, t."totalScore", t."validBugsCount", t."hasMilestoneBonus", t."createdAt",
      coalesce(count(distinct case when s.status = 'VERIFIED' and s."isSpeedBonus" = true then s.id end), 0)::int as "speedBonusCount",
      coalesce(count(distinct tr.id), 0)::int as "treasuresClaimedCount",
      coalesce(count(distinct case when s.status = 'VERIFIED' then s.id end), 0)::int as "verifiedSubmissionsCount"
    FROM "Team" t
    LEFT JOIN "RegularSubmission" s ON s."teamId" = t.id
    LEFT JOIN "TreasureBug" tr ON tr."claimedByTeamId" = t.id
    GROUP BY t.id, t.name, t.email, t."totalScore", t."validBugsCount", t."hasMilestoneBonus", t."createdAt"
    ORDER BY t."totalScore" DESC, t."validBugsCount" DESC, t."createdAt" ASC;
  `;
  console.log(`Query succeeded in ${Date.now() - t0}ms! Teams count: ${teams.length}`);
  console.log(teams);
}

main().catch(console.error);
