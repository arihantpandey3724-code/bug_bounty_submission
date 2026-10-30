import { PrismaClient } from "@prisma/client";
import { MASTER_BUGS, INITIAL_TREASURES, DEMO_TEAMS } from "../src/config/masterBugs";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log("Seeding Master Bugs...");
  for (const bug of MASTER_BUGS) {
    await prisma.masterBug.upsert({
      where: { id: bug.id },
      update: {
        title: bug.title,
        category: bug.category,
        basePoints: bug.basePoints,
        speedBonusPoints: bug.speedBonusPoints,
        expected: bug.expected,
        actual: bug.actual,
        location: bug.location,
      },
      create: bug,
    });
  }
  console.log(`Seeded ${MASTER_BUGS.length} Master Bugs successfully.`);

  console.log("Seeding 10 Treasure Bug slots...");
  for (const t of INITIAL_TREASURES) {
    await prisma.treasureBug.upsert({
      where: { id: t.id },
      update: { code: t.code },
      create: {
        id: t.id,
        code: t.code,
        isClaimed: false,
      },
    });
  }
  console.log("Seeded 10 Treasure Bugs.");

  console.log("Initializing Milestone Tracker...");
  await prisma.milestoneTracker.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  console.log("Seeding Demo Teams...");
  for (const team of DEMO_TEAMS) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: {},
      create: {
        name: team.name,
        email: team.email,
        totalScore: 0,
        validBugsCount: 0,
        hasMilestoneBonus: false,
      },
    });
  }
  console.log("Demo teams seeded successfully.");
}

main()
  .catch((e) => {
    console.warn("Seeding note (DB may be offline locally):", e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
