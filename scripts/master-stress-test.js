/**
 * Master Comprehensive Stress Test Suite for Bug Bounty Submission Portal
 * Target: https://bug-bounty-submission.vercel.app/
 */

const { neon } = require("@neondatabase/serverless");

const TARGET_URL = "https://bug-bounty-submission.vercel.app";
const DATABASE_URL = "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

// Master bug reproduction descriptions for testing AI & heuristic evaluation
const TEST_BUGS = [
  {
    id: "EASY-01",
    desc: "Clicking the Amazon smile logo in the top navbar navigates to /wrong-route instead of the homepage.",
    snippet: '<Link href="/wrong-route" className="logo">Amazon</Link>'
  },
  {
    id: "EASY-02",
    desc: "Toggling the theme mode button in the header does not persist and inverts the icon colors incorrectly.",
    snippet: 'const toggleTheme = () => setIsDark(!isDark);'
  },
  {
    id: "EASY-03",
    desc: "Header shopping cart badge counter is static and remains at 0 even after adding items to the cart.",
    snippet: 'const displayedCartCount = 0;'
  },
  {
    id: "MED-01",
    desc: "Selecting electronics category in the search filter dropdown results in empty results even though products exist.",
    snippet: 'products.filter(p => p.category === selectedCategory)'
  },
  {
    id: "MED-02",
    desc: "Clicking the quantity plus button on the cart page increments the quantity by 2 instead of 1.",
    snippet: 'setQuantity(q => q + 2);'
  },
  {
    id: "HARD-01",
    desc: "Cancelling an order shows order cancelled temporarily, but on page refresh the order reverts to Processing for Shipment.",
    snippet: 'router.refresh(); // order status not committed to DB'
  }
];

class MetricsTracker {
  constructor(phaseName) {
    this.phaseName = phaseName;
    this.results = [];
    this.startTime = Date.now();
  }

  record(name, status, duration, error = null) {
    this.results.push({ name, status, duration, error });
  }

  report() {
    const total = this.results.length;
    const successes = this.results.filter(r => r.status >= 200 && r.status < 400).length;
    const clientErrors = this.results.filter(r => r.status >= 400 && r.status < 500).length;
    const serverErrors = this.results.filter(r => r.status >= 500 || r.status === 0).length;
    const durations = this.results.map(r => r.duration).sort((a, b) => a - b);

    const sum = durations.reduce((acc, d) => acc + d, 0);
    const mean = total > 0 ? (sum / total).toFixed(1) : 0;
    const min = durations[0] || 0;
    const max = durations[durations.length - 1] || 0;
    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p90 = durations[Math.floor(durations.length * 0.9)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

    const totalSec = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const rps = (total / (Date.now() - this.startTime) * 1000).toFixed(1);

    const statusCounts = {};
    for (const r of this.results) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    }

    console.log(`\n--- [${this.phaseName}] Results ---`);
    console.log(`Total Requests:    ${total}`);
    console.log(`2xx Success:       ${successes} (${((successes/total)*100).toFixed(1)}%)`);
    console.log(`4xx Client Handled:${clientErrors}`);
    console.log(`5xx/Failures:      ${serverErrors}`);
    console.log(`Throughput:        ${rps} req/sec in ${totalSec}s`);
    console.log(`Latency (ms):      min=${min} | p50=${p50} | avg=${mean} | p95=${p95} | p99=${p99} | max=${max}`);
    console.log(`Status Codes:     `, statusCounts);

    return { total, successes, clientErrors, serverErrors, rps, p50, p95, p99, max };
  }
}

async function runConcurrentPool(tasks, concurrency, metrics) {
  const queue = [...tasks];
  const workers = Array.from({ length: concurrency }, async (_, workerIdx) => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      const t0 = Date.now();
      try {
        const res = await fetch(task.url, {
          method: task.method || "GET",
          headers: task.headers || {},
          body: task.body ? JSON.stringify(task.body) : undefined,
          signal: AbortSignal.timeout(task.timeoutMs || 20000)
        });
        const duration = Date.now() - t0;
        let data = null;
        try { data = await res.json(); } catch {}
        metrics.record(task.name, res.status, duration);
        if (task.onSuccess) task.onSuccess(res, data);
      } catch (err) {
        const duration = Date.now() - t0;
        metrics.record(task.name, 0, duration, err.message);
        if (task.onError) task.onError(err);
      }
    }
  });

  await Promise.all(workers);
}

async function main() {
  console.log("========================================================================");
  console.log("🔥 INITIATING COMPREHENSIVE STRESS TEST ON LIVE VERCEL SUBMISSION PORTAL");
  console.log(`   Target Endpoint: ${TARGET_URL}`);
  console.log("========================================================================\n");

  const overallStart = Date.now();
  const createdTeams = [];

  // ===========================================================================
  // PHASE 1: ACCOUNT CREATION & AUTH CONCURRENCY (50 concurrent registrations)
  // ===========================================================================
  console.log("⚡ PHASE 1: Account Creation & Authentication Stress (50 concurrent users)...");
  const p1Metrics = new MetricsTracker("Phase 1: Team Registration & Auth");
  const regTasks = [];
  const testRunId = Date.now();

  for (let i = 1; i <= 50; i++) {
    const teamName = `StressTeam_${testRunId}_${i}`;
    const email = `stress_${testRunId}_${i}@entropy-stress.org`;
    regTasks.push({
      name: "POST /api/teams",
      url: `${TARGET_URL}/api/teams`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { name: teamName, email: email },
      onSuccess: (res, data) => {
        if (res.ok && data?.team?.id) {
          createdTeams.push(data.team);
        }
      }
    });
  }

  // Also include 15 duplicate registrations to test duplicate/conflict handling
  for (let i = 1; i <= 15; i++) {
    regTasks.push({
      name: "POST /api/teams (Duplicate Check)",
      url: `${TARGET_URL}/api/teams`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { name: `StressTeam_${testRunId}_1`, email: `stress_${testRunId}_1@entropy-stress.org` }
    });
  }

  await runConcurrentPool(regTasks, 15, p1Metrics);
  p1Metrics.report();
  console.log(`✓ Successfully registered & authenticated ${createdTeams.length} test teams.`);

  // ===========================================================================
  // PHASE 2: CONCURRENT PROFILE FETCHES (50 concurrent reads)
  // ===========================================================================
  console.log("\n⚡ PHASE 2: Team Session & Profile Lookups (50 concurrent GETs)...");
  const p2Metrics = new MetricsTracker("Phase 2: Profile & Session Reads");
  const profileTasks = [];

  for (let i = 0; i < Math.min(createdTeams.length, 50); i++) {
    const t = createdTeams[i];
    profileTasks.push({
      name: "GET /api/teams?id=",
      url: `${TARGET_URL}/api/teams?id=${t.id}`
    });
    profileTasks.push({
      name: "GET /api/teams?email=",
      url: `${TARGET_URL}/api/teams?email=${encodeURIComponent(t.email)}`
    });
  }

  await runConcurrentPool(profileTasks, 20, p2Metrics);
  p2Metrics.report();

  // ===========================================================================
  // PHASE 3: CONCURRENT BUG SUBMISSIONS (80 submissions, AI/heuristic triage)
  // ===========================================================================
  console.log("\n⚡ PHASE 3: Concurrent Bug Submissions (80 bug reports with AI matching & speed bonus)...");
  const p3Metrics = new MetricsTracker("Phase 3: Bug Submissions");
  const subTasks = [];
  const submittedSubIds = [];

  for (let i = 0; i < 80; i++) {
    const assignedTeam = createdTeams[i % createdTeams.length] || { id: "cmvvc7zfv0000f14rdqli41md" };
    const bugTemplate = TEST_BUGS[i % TEST_BUGS.length];
    subTasks.push({
      name: `POST /api/submissions (${bugTemplate.id})`,
      url: `${TARGET_URL}/api/submissions`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        teamId: assignedTeam.id,
        description: `[StressTest #${i + 1}] Defect found: ${bugTemplate.desc}`,
        codeSnippet: bugTemplate.snippet
      },
      onSuccess: (res, data) => {
        if (data?.submission?.id) {
          submittedSubIds.push(data.submission.id);
        }
      }
    });
  }

  await runConcurrentPool(subTasks, 15, p3Metrics);
  p3Metrics.report();
  console.log(`✓ Successfully submitted and triaged ${submittedSubIds.length} bug reports.`);

  // ===========================================================================
  // PHASE 4: TREASURE CODE RACE CONDITION TEST (10 teams racing for 1 code)
  // ===========================================================================
  console.log("\n⚡ PHASE 4: Treasure Code Race Condition (10 teams simultaneously claiming 1 flag)...");
  const p4Metrics = new MetricsTracker("Phase 4: Treasure Race Condition");
  const raceTeamCandidates = createdTeams.slice(0, 10);
  const targetTreasureCode = "TREASURE-DOM-INSPECT";

  const raceTasks = raceTeamCandidates.map((t, idx) => ({
    name: `Claim Treasure (Team ${idx + 1})`,
    url: `${TARGET_URL}/api/treasures/claim`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      teamId: t.id,
      code: targetTreasureCode
    }
  }));

  // Fire all 10 simultaneously in single tick
  await runConcurrentPool(raceTasks, 10, p4Metrics);
  p4Metrics.report();

  // ===========================================================================
  // PHASE 5: LEADERBOARD & UI AVALANCHE (200 concurrent requests)
  // ===========================================================================
  console.log("\n⚡ PHASE 5: Leaderboard & UI Avalanche (200 concurrent requests)...");
  const p5Metrics = new MetricsTracker("Phase 5: Leaderboard Avalanche");
  const avalancheTasks = [];

  for (let i = 0; i < 100; i++) {
    avalancheTasks.push({ name: "GET /api/leaderboard", url: `${TARGET_URL}/api/leaderboard` });
  }
  for (let i = 0; i < 40; i++) {
    avalancheTasks.push({ name: "GET /api/treasures", url: `${TARGET_URL}/api/treasures` });
  }
  for (let i = 0; i < 30; i++) {
    avalancheTasks.push({ name: "GET /leaderboard (UI)", url: `${TARGET_URL}/leaderboard` });
  }
  for (let i = 0; i < 30; i++) {
    avalancheTasks.push({ name: "GET /submit (UI)", url: `${TARGET_URL}/submit` });
  }

  await runConcurrentPool(avalancheTasks, 25, p5Metrics);
  p5Metrics.report();

  // ===========================================================================
  // PHASE 6: DATABASE INTEGRITY AUDIT
  // ===========================================================================
  console.log("\n⚡ PHASE 6: Performing Direct Neon DB Consistency Audit...");
  const sql = neon(DATABASE_URL);

  const teamStats = await sql`
    SELECT count(*)::int as total_teams, 
           coalesce(sum("totalScore"), 0)::int as total_score,
           coalesce(sum("validBugsCount"), 0)::int as total_valid_bugs
    FROM "Team";
  `;

  const subStats = await sql`
    SELECT count(*)::int as total_subs,
           count(case when "status" = 'VERIFIED' then 1 end)::int as verified_subs,
           count(case when "status" = 'UNVERIFIED' then 1 end)::int as unverified_subs,
           count(case when "status" = 'REJECTED' then 1 end)::int as rejected_subs,
           count(case when "isSpeedBonus" = true then 1 end)::int as speed_bonuses
    FROM "RegularSubmission";
  `;

  const treasureStats = await sql`
    SELECT count(*)::int as total_treasures,
           count(case when "isClaimed" = true then 1 end)::int as claimed_treasures
    FROM "TreasureBug";
  `;

  console.log("------------------------------------------------------------------------");
  console.log("📊 NEON POSTGRESQL INTEGRITY AUDIT SUMMARY");
  console.log("------------------------------------------------------------------------");
  console.log(`Total Teams in DB:         ${teamStats[0].total_teams}`);
  console.log(`Total Aggregate Points:    ${teamStats[0].total_score}`);
  console.log(`Total Valid Bugs Count:    ${teamStats[0].total_valid_bugs}`);
  console.log(`Total Submissions:         ${subStats[0].total_subs}`);
  console.log(`  - Verified Submissions:  ${subStats[0].verified_subs}`);
  console.log(`  - Unverified Submissions:${subStats[0].unverified_subs}`);
  console.log(`  - Rejected Submissions:  ${subStats[0].rejected_subs}`);
  console.log(`  - Speed Bonuses Awarded: ${subStats[0].speed_bonuses}`);
  console.log(`Total Treasures:           ${treasureStats[0].total_treasures}`);
  console.log(`  - Claimed Treasures:     ${treasureStats[0].claimed_treasures}`);
  console.log("------------------------------------------------------------------------");

  // Check for any score mismatch
  const scoreAudits = await sql`
    SELECT t.id, t.name, t."totalScore", 
           coalesce(sum(s."awardedPoints"), 0)::int as sub_points
    FROM "Team" t
    LEFT JOIN "RegularSubmission" s ON s."teamId" = t.id
    GROUP BY t.id, t.name, t."totalScore"
    LIMIT 10;
  `;
  console.log("Sample Team Score Integrity (Score vs Submissions):");
  for (const s of scoreAudits) {
    console.log(`  • Team "${s.name}": DB Score = ${s.totalScore} | Submissions Total = ${s.sub_points}`);
  }

  const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(1);
  console.log("\n========================================================================");
  console.log(`🏁 FULL STRESS TEST COMPLETED IN ${totalDuration} SECONDS`);
  console.log("========================================================================\n");
}

main().catch(err => {
  console.error("Master Stress Test Exception:", err);
  process.exit(1);
});
