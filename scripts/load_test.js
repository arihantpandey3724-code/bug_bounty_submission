/**
 * Entropy 2K26 — 200 Virtual Participant Concurrency & Stress Test Suite
 * 
 * Usage:
 *   node scripts/load_test.js [target_url]
 * Examples:
 *   node scripts/load_test.js http://localhost:3001
 *   node scripts/load_test.js https://your-deployment.vercel.app
 */

const TARGET_URL = process.argv[2] || "http://localhost:3001";
const TOTAL_USERS = 200;
const BATCH_SIZE = 50; // Concurrency batching

console.log(`=======================================================`);
console.log(`🚀 STARTING STRESS TEST: 200 VIRTUAL USERS`);
console.log(`🎯 Target Platform: ${TARGET_URL}`);
console.log(`=======================================================\n`);

async function runScenario(userId) {
  const startTime = Date.now();
  const teamName = `StressTest_Team_${userId}`;
  const teamEmail = `stress_user_${userId}@test.entropy.local`;

  const results = {
    userId,
    teamId: null,
    registrationOk: false,
    leaderboardOk: false,
    submissionOk: false,
    treasureVaultOk: false,
    errors: [],
    totalDurationMs: 0,
  };

  try {
    // 1. Participant visits Homepage & Leaderboard
    const lbRes = await fetch(`${TARGET_URL}/api/leaderboard`, { method: "GET" });
    if (lbRes.ok) {
      results.leaderboardOk = true;
    } else {
      results.errors.push(`Leaderboard GET returned ${lbRes.status}`);
    }

    // 2. Participant visits Treasure Vault tracker
    const trRes = await fetch(`${TARGET_URL}/api/treasures`, { method: "GET" });
    if (trRes.ok) {
      results.treasureVaultOk = true;
    } else {
      results.errors.push(`Treasures GET returned ${trRes.status}`);
    }

    // 3. Participant Registers a Team
    const regRes = await fetch(`${TARGET_URL}/api/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: teamName, email: teamEmail }),
    });

    if (regRes.ok) {
      const regData = await regRes.json();
      results.teamId = regData.team?.id;
      results.registrationOk = true;
    } else {
      results.errors.push(`Team Registration POST returned ${regRes.status}`);
    }

    // 4. Participant Submits a Bug Report (if team registered)
    if (results.teamId) {
      const subRes = await fetch(`${TARGET_URL}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: results.teamId,
          description: `Automated concurrency verification test from User ${userId}: Quantity counter drops into negative values on PDP buy box.`,
        }),
      });

      if (subRes.ok) {
        results.submissionOk = true;
      } else {
        results.errors.push(`Bug Submission POST returned ${subRes.status}`);
      }
    }
  } catch (err) {
    results.errors.push(`Network exception: ${err.message}`);
  }

  results.totalDurationMs = Date.now() - startTime;
  return results;
}

async function main() {
  const overallStart = Date.now();
  const allResults = [];

  console.log(`Simulating ${TOTAL_USERS} users in batches of ${BATCH_SIZE} concurrent connections...\n`);

  for (let i = 0; i < TOTAL_USERS; i += BATCH_SIZE) {
    const currentBatch = [];
    const count = Math.min(BATCH_SIZE, TOTAL_USERS - i);

    for (let j = 0; j < count; j++) {
      currentBatch.push(runScenario(i + j + 1));
    }

    process.stdout.write(`⚡ Dispatching batch: Users ${i + 1} to ${i + count}... `);
    const batchResults = await Promise.all(currentBatch);
    allResults.push(...batchResults);
    console.log(`[Batch Finished]`);
  }

  const totalTimeSec = ((Date.now() - overallStart) / 1000).toFixed(2);

  // Aggregate Stats
  const successfulRegistrations = allResults.filter((r) => r.registrationOk).length;
  const successfulSubmissions = allResults.filter((r) => r.submissionOk).length;
  const successfulLeaderboards = allResults.filter((r) => r.leaderboardOk).length;
  const successfulTreasures = allResults.filter((r) => r.treasureVaultOk).length;
  const totalErrors = allResults.reduce((acc, r) => acc + r.errors.length, 0);

  const latencies = allResults.map((r) => r.totalDurationMs).sort((a, b) => a - b);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const max = latencies[latencies.length - 1];

  console.log(`\n=======================================================`);
  console.log(`📊 STRESS TEST RESULTS FOR ${TOTAL_USERS} CONCURRENT USERS`);
  console.log(`=======================================================`);
  console.log(`⏱️  Total Test Execution Time: ${totalTimeSec} seconds`);
  console.log(`👥 Total Simulated Participants: ${TOTAL_USERS}`);
  console.log(`📋 Leaderboard Fetches Passed:  ${successfulLeaderboards} / ${TOTAL_USERS} (${((successfulLeaderboards/TOTAL_USERS)*100).toFixed(1)}%)`);
  console.log(`💎 Treasure Vault Fetches:     ${successfulTreasures} / ${TOTAL_USERS} (${((successfulTreasures/TOTAL_USERS)*100).toFixed(1)}%)`);
  console.log(`📝 Team Registrations Passed:   ${successfulRegistrations} / ${TOTAL_USERS} (${((successfulRegistrations/TOTAL_USERS)*100).toFixed(1)}%)`);
  console.log(`🐞 Bug Submissions Processed:  ${successfulSubmissions} / ${TOTAL_USERS} (${((successfulSubmissions/TOTAL_USERS)*100).toFixed(1)}%)`);
  console.log(`❌ Total Network / HTTP Errors: ${totalErrors}`);
  console.log(`-------------------------------------------------------`);
  console.log(`📈 User Flow Latency Metrics:`);
  console.log(`   - Average: ${avgLatency} ms`);
  console.log(`   - Median (p50): ${p50} ms`);
  console.log(`   - 95th Percentile (p95): ${p95} ms`);
  console.log(`   - Maximum Latency: ${max} ms`);
  console.log(`=======================================================\n`);

  if (totalErrors === 0 && successfulSubmissions === TOTAL_USERS) {
    console.log(`✅ EXCELLENT: System handled all 200 users with zero failures!`);
  } else if (totalErrors > 0) {
    console.log(`⚠️  Sample Errors Encountered:`);
    const uniqueErrors = [...new Set(allResults.flatMap((r) => r.errors))].slice(0, 5);
    uniqueErrors.forEach((e) => console.log(`   - ${e}`));
  }
}

main();
