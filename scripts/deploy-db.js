const { execSync } = require('child_process');
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not needed if env vars injected by Vercel
}

function setupDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
    console.log('[deploy-db] Skipping automatic cloud db push: No external DATABASE_URL provided.');
    return;
  }

  console.log('[deploy-db] Detected external DATABASE_URL. Pushing Prisma schema to cloud database...');
  try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log('[deploy-db] Schema pushed successfully. Seeding Master Bugs and 10 Treasure Bug slots...');
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
    console.log('[deploy-db] Master Bugs and initial records seeded successfully!');
  } catch (error) {
    console.warn('[deploy-db] Warning during DB push/seed:', error.message);
  }
}

setupDatabase();
