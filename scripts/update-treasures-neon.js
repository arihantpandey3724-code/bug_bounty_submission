const { neon } = require("@neondatabase/serverless");

const DATABASE_URL = "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  console.log("Connecting to Neon via HTTP Serverless driver...");
  const sql = neon(DATABASE_URL);

  const treasures = [
    { id: 1, code: "TREASURE-ENTROPY-2026" },
    { id: 2, code: "TREASURE-GOATED-ENTROPY" },
    { id: 3, code: "TREASURE-MULTI-CLICK" },
    { id: 4, code: "TREASURE-DOM-INSPECT" },
    { id: 5, code: "TREASURE-INVOICE-PRINT" },
  ];

  for (const t of treasures) {
    await sql`
      INSERT INTO "TreasureBug" ("id", "code", "isClaimed")
      VALUES (${t.id}, ${t.code}, false)
      ON CONFLICT ("id") DO UPDATE SET "code" = ${t.code}, "isClaimed" = false, "claimedByTeamId" = NULL, "claimedAt" = NULL;
    `;
    console.log(`Updated Neon Treasure #${t.id} -> ${t.code}`);
  }

  const rows = await sql`SELECT "id", "code", "isClaimed" FROM "TreasureBug" ORDER BY "id" ASC;`;
  console.log("Neon DB Current Treasures:\n", rows);
}

main().catch(console.error);
