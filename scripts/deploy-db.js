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

  console.log('[deploy-db] Detected external DATABASE_URL. Running safe additive provisioning (CREATE TABLE IF NOT EXISTS)...');
  try {
    execSync('npx tsx scripts/provision-neon-portal.js', { stdio: 'inherit' });
    console.log('[deploy-db] Safe database provisioning and Master Bugs seeding completed!');
  } catch (error) {
    console.warn('[deploy-db] Warning during DB provisioning:', error.message);
  }
}

setupDatabase();
