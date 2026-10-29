/**
 * 500-User Stress Test Suite for Live Vercel Deployments:
 * - Storefront Replica: https://bug-bounty-liart.vercel.app
 * - Submission Portal: https://bug-bounty-submission.vercel.app
 */

const SUBMISSION_BASE = 'https://bug-bounty-submission.vercel.app';
const STOREFRONT_BASE = 'https://bug-bounty-liart.vercel.app';

const CONCURRENCY = 25; // 25 simultaneous active connections
const TOTAL_REQUESTS = 500;

// Sample bug descriptions to test AI triage & heuristic matching
const SAMPLE_BUGS = [
  'The search suggestions dropdown in the header repeats duplicate query strings and clicking them navigates nowhere.',
  'Cart total calculation displays NaN when applying the holiday promo discount code.',
  'Quantity increment button on product detail page triggers double increment on mobile viewports.',
  'Checkout form allows submission without entering mandatory billing address ZIP code.',
  'Star rating filter in sidebar displays 6 stars instead of 5 stars.',
  'Footer copyright year displays undefined instead of 2026.',
  'Product image carousel throws unhandled rejection when swiping left on empty category.',
  'Sort by price low-to-high actually sorts products alphabetically by title.',
  'Delete item button in shopping cart requires two clicks to remove product.',
  'Wishlist button does not persist state across page reloads.'
];

class Metrics {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  record(name, status, duration, error = null) {
    this.results.push({ name, status, duration, error });
  }

  summary() {
    const total = this.results.length;
    const successes = this.results.filter(r => r.status >= 200 && r.status < 400).length;
    const failures = total - successes;
    const durations = this.results.map(r => r.duration).sort((a, b) => a - b);

    const sum = durations.reduce((acc, d) => acc + d, 0);
    const mean = total > 0 ? (sum / total).toFixed(1) : 0;
    const min = durations[0] || 0;
    const max = durations[durations.length - 1] || 0;
    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p90 = durations[Math.floor(durations.length * 0.9)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

    // Status breakdown
    const statusCounts = {};
    for (const r of this.results) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    }

    // Per endpoint breakdown
    const byEndpoint = {};
    for (const r of this.results) {
      if (!byEndpoint[r.name]) {
        byEndpoint[r.name] = { total: 0, success: 0, durations: [] };
      }
      byEndpoint[r.name].total++;
      if (r.status >= 200 && r.status < 400) byEndpoint[r.name].success++;
      byEndpoint[r.name].durations.push(r.duration);
    }

    const endpointSummaries = {};
    for (const [name, data] of Object.entries(byEndpoint)) {
      const sorted = data.durations.sort((a, b) => a - b);
      const avg = (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(1);
      const p95Ep = sorted[Math.floor(sorted.length * 0.95)] || 0;
      endpointSummaries[name] = {
        total: data.total,
        success: data.success,
        successRate: `${((data.success / data.total) * 100).toFixed(1)}%`,
        avgLatencyMs: avg,
        p95Ms: p95Ep
      };
    }

    const totalDurationSec = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const rps = (total / (Date.now() - this.startTime) * 1000).toFixed(1);

    return {
      totalRequests: total,
      successful: successes,
      failed: failures,
      successRate: `${((successes / total) * 100).toFixed(2)}%`,
      totalTimeSec: totalDurationSec,
      requestsPerSecond: rps,
      latencyMs: { min, p50, mean, p90, p95, p99, max },
      statusCodes: statusCounts,
      endpointSummaries
    };
  }
}

async function runWorker(tasks, metrics, workerId) {
  while (tasks.length > 0) {
    const task = tasks.shift();
    if (!task) break;

    const t0 = Date.now();
    try {
      const res = await fetch(task.url, {
        method: task.method || 'GET',
        headers: task.headers || {},
        body: task.body ? JSON.stringify(task.body) : undefined,
        signal: AbortSignal.timeout(15000) // 15s timeout
      });
      const duration = Date.now() - t0;
      metrics.record(task.name, res.status, duration);
    } catch (err) {
      const duration = Date.now() - t0;
      metrics.record(task.name, 0, duration, err.message);
    }
  }
}

async function startStressTest() {
  console.log('================================================================');
  console.log('🚀 INITIATING 500-REQUEST STRESS TEST ON LIVE VERCEL DEPLOYMENT');
  console.log(`   - Submission Target: ${SUBMISSION_BASE}`);
  console.log(`   - Storefront Target: ${STOREFRONT_BASE}`);
  console.log(`   - Concurrency Pool:  ${CONCURRENCY} simultaneous workers`);
  console.log('================================================================\n');

  const metrics = new Metrics();

  // Step 1: Pre-register 10 seed teams on Vercel to use for concurrent submissions
  console.log('⚡ Step 1: Provisioning test teams on live Vercel deployment...');
  const testTeamIds = [];
  for (let i = 1; i <= 10; i++) {
    try {
      const teamRes = await fetch(`${SUBMISSION_BASE}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `StressTest_Team_${Date.now()}_${i}`,
          email: `stress_${Date.now()}_${i}@entropy-stress.io`
        })
      });
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        const teamId = teamData.team?.id || teamData.id;
        if (teamId) testTeamIds.push(teamId);
      }
    } catch (e) {
      console.warn('Seed team registration notice:', e.message);
    }
  }

  // Fallback if team creation hit any barrier
  if (testTeamIds.length === 0) {
    testTeamIds.push('team-local-cyberknights', 'team-local-bugbusters');
  }
  console.log(`✓ Provisioned ${testTeamIds.length} team identities for submission load.\n`);

  // Step 2: Build 500 task queue
  console.log('⚡ Step 2: Assembling 500 distributed workload tasks...');
  const tasks = [];

  // Group A: Storefront traffic (100 requests)
  for (let i = 0; i < 60; i++) {
    tasks.push({ name: 'Storefront: Home Page', url: `${STOREFRONT_BASE}/` });
  }
  for (let i = 0; i < 20; i++) {
    tasks.push({ name: 'Storefront: Cart Page', url: `${STOREFRONT_BASE}/cart` });
  }
  for (let i = 0; i < 20; i++) {
    tasks.push({ name: 'Storefront: Product Page', url: `${STOREFRONT_BASE}/product/1` });
  }

  // Group B: Submission Portal UI Pages (100 requests)
  for (let i = 0; i < 35; i++) {
    tasks.push({ name: 'Portal UI: Submit Page', url: `${SUBMISSION_BASE}/submit` });
  }
  for (let i = 0; i < 35; i++) {
    tasks.push({ name: 'Portal UI: Leaderboard Page', url: `${SUBMISSION_BASE}/leaderboard` });
  }
  for (let i = 0; i < 15; i++) {
    tasks.push({ name: 'Portal UI: Treasures Page', url: `${SUBMISSION_BASE}/treasures` });
  }
  for (let i = 0; i < 15; i++) {
    tasks.push({ name: 'Portal UI: Home Portal', url: `${SUBMISSION_BASE}/` });
  }

  // Group C: Live Read APIs (100 requests)
  for (let i = 0; i < 35; i++) {
    tasks.push({ name: 'API Read: /api/leaderboard', url: `${SUBMISSION_BASE}/api/leaderboard` });
  }
  for (let i = 0; i < 25; i++) {
    tasks.push({ name: 'API Read: /api/teams', url: `${SUBMISSION_BASE}/api/teams` });
  }
  for (let i = 0; i < 20; i++) {
    tasks.push({ name: 'API Read: /api/treasures', url: `${SUBMISSION_BASE}/api/treasures` });
  }
  for (let i = 0; i < 20; i++) {
    tasks.push({ name: 'API Read: /api/admin/portal-status', url: `${SUBMISSION_BASE}/api/admin/portal-status` });
  }

  // Group D: Heavy Concurrent Team Registrations (50 requests)
  for (let i = 0; i < 50; i++) {
    tasks.push({
      name: 'API Write: /api/teams (Register)',
      url: `${SUBMISSION_BASE}/api/teams`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: `Stress_Squad_${Date.now()}_${i}`,
        email: `squad_${Date.now()}_${i}@entropy-load.org`
      }
    });
  }

  // Group E: Heavy Concurrent Bug Submissions (150 requests)
  for (let i = 0; i < 150; i++) {
    const assignedTeamId = testTeamIds[i % testTeamIds.length];
    const desc = SAMPLE_BUGS[i % SAMPLE_BUGS.length];
    tasks.push({
      name: 'API Write: /api/submissions (Bug Submit)',
      url: `${SUBMISSION_BASE}/api/submissions`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        teamId: assignedTeamId,
        description: `[LoadTest #${i + 1}] ${desc}`,
        codeSnippet: `// simulated client trace ${i + 1}`
      }
    });
  }

  // Shuffle tasks so load is realistically interleaved
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  }

  console.log(`✓ Workload generated: Exactly ${tasks.length} tasks ready for dispatch.`);
  console.log(`⚡ Launching ${CONCURRENCY} concurrent workers into the fray...\n`);

  const tStart = Date.now();
  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(runWorker(tasks, metrics, w + 1));
  }

  // Progress heartbeat every 3 seconds
  const heartbeat = setInterval(() => {
    const completed = metrics.results.length;
    const pct = ((completed / TOTAL_REQUESTS) * 100).toFixed(1);
    const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
    console.log(`   [Progress] ${completed}/${TOTAL_REQUESTS} requests completed (${pct}%) in ${elapsed}s...`);
  }, 3000);

  await Promise.all(workers);
  clearInterval(heartbeat);

  const summary = metrics.summary();

  console.log('\n================================================================');
  console.log('📊 500-REQUEST STRESS TEST COMPLETE — FINAL AUDIT REPORT');
  console.log('================================================================');
  console.log(`Total Requests:      ${summary.totalRequests}`);
  console.log(`Successful (2xx):    ${summary.successful}`);
  console.log(`Failed / Errors:     ${summary.failed}`);
  console.log(`Overall Success Rate:${summary.successRate}`);
  console.log(`Total Execution Time:${summary.totalTimeSec} seconds`);
  console.log(`Throughput:          ${summary.requestsPerSecond} req/sec`);
  console.log('----------------------------------------------------------------');
  console.log('Latency Statistics:');
  console.log(`  - Minimum:         ${summary.latencyMs.min} ms`);
  console.log(`  - P50 (Median):    ${summary.latencyMs.p50} ms`);
  console.log(`  - Average:         ${summary.latencyMs.mean} ms`);
  console.log(`  - P90:             ${summary.latencyMs.p90} ms`);
  console.log(`  - P95:             ${summary.latencyMs.p95} ms`);
  console.log(`  - P99:             ${summary.latencyMs.p99} ms`);
  console.log(`  - Maximum:         ${summary.latencyMs.max} ms`);
  console.log('----------------------------------------------------------------');
  console.log('HTTP Status Codes Returned:');
  for (const [code, count] of Object.entries(summary.statusCodes)) {
    console.log(`  - HTTP ${code}: ${count} responses`);
  }
  console.log('----------------------------------------------------------------');
  console.log('Breakdown by Endpoint:');
  for (const [name, stats] of Object.entries(summary.endpointSummaries)) {
    console.log(`  • ${name.padEnd(38)} | Success: ${stats.successRate.padStart(6)} | Avg: ${stats.avgLatencyMs.padStart(6)}ms | P95: ${stats.p95Ms.toString().padStart(6)}ms`);
  }
  console.log('================================================================\n');

  // Save report to disk
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '..', 'data', 'stress_test_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Full JSON report saved to: ${reportPath}`);
}

startStressTest().catch(err => {
  console.error('Fatal stress test failure:', err);
  process.exit(1);
});
