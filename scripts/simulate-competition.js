/**
 * Entropy Bug Bounty Portal - 10-Person 20-Minute Concurrent Stress Simulation
 *
 * Simulates 10 concurrent participants performing realistic competition loops:
 * - Creating teams & logging in / switching devices
 * - Filing bug reports with descriptions, code snippets, and reproduction steps
 * - Checking their submitted reports in "My Submissions"
 * - Refreshing the live Leaderboard
 * - Viewing and inspecting the Treasure Vault
 *
 * Usage:
 *   node scripts/simulate-competition.js
 *   node scripts/simulate-competition.js --url=https://bug-bounty-submission.vercel.app --users=10 --duration=20
 */

const https = require("https");
const http = require("http");

// Parse CLI Arguments
const args = process.argv.slice(2).reduce((acc, cur) => {
  const [k, v] = cur.replace(/^--/, "").split("=");
  acc[k] = v || true;
  return acc;
}, {});

const TARGET_URL = (typeof args.url === "string" ? args.url : "https://bug-bounty-submission.vercel.app").replace(/\/$/, "");
const NUM_USERS = parseInt(args.users || "10", 10);
const DURATION_MINUTES = parseFloat(args.duration || "20");
const DURATION_MS = DURATION_MINUTES * 60 * 1000;

const BUG_POOL = [
  {
    description: "Autofill continue button in checkout remains disabled even after selecting a valid address.",
    codeSnippet: "const isContinueDisabled = !selectedAddress || !isFormDirty;",
  },
  {
    description: "Theme toggle button requires 10 clicks and triggers a treasure hunt reward modal.",
    codeSnippet: "if (clickCount >= 10) triggerTreasureBug();",
  },
  {
    description: "Cart badge counter overlaps with the shopping cart SVG icon on mobile viewport.",
    codeSnippet: "<span className=\"absolute -top-1.5 -right-1 text-xs\">{cartCount}</span>",
  },
  {
    description: "Sorting products by Price Low to High reverses results and displays highest price first.",
    codeSnippet: "products.sort((a, b) => b.price - a.price); // inverted comparator",
  },
  {
    description: "Voucher code SAVE20 applies discount twice if clicked repeatedly before network resolves.",
    codeSnippet: "applyDiscount(orderTotal * 0.2); // race condition without button debounce",
  },
  {
    description: "Order status shows Delivered immediately upon placement before payment authorization.",
    codeSnippet: "const orderStatus = 'DELIVERED'; // hardcoded initial state",
  },
  {
    description: "Quantity input field in cart accepts negative numbers and reduces cart total below zero.",
    codeSnippet: "<input type=\"number\" min=\"-99\" value={qty} />",
  },
  {
    description: "Product specification table displays 'undefined' for technical specifications.",
    codeSnippet: "return <td>{product.specs?.dimensions || 'undefined'}</td>;",
  },
  {
    description: "Search filter dropdown closes prematurely on keyboard arrow navigation.",
    codeSnippet: "onKeyDown={(e) => { if (e.key === 'ArrowDown') setIsOpen(false); }}",
  },
  {
    description: "Sign-in modal fails to clear validation error when user corrects invalid email format.",
    codeSnippet: "setError(null); // missing in onInputChange handler",
  },
];

// Telemetry Metrics
const stats = {
  startTime: Date.now(),
  endTime: Date.now() + DURATION_MS,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  latencies: [],
  actions: {
    teamAuth: 0,
    submissions: 0,
    submissionsList: 0,
    leaderboardViews: 0,
    treasureViews: 0,
  },
  errors: [],
};

// Helper: HTTP Request with Latency Measurement
function makeRequest(method, path, body = null) {
  return new Promise((resolve) => {
    const start = Date.now();
    const url = new URL(`${TARGET_URL}${path}`);
    const isHttps = url.protocol === "https:";
    const client = isHttps ? https : http;

    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Entropy-StressTester/2.0",
      },
      timeout: 10000,
    };

    if (body) {
      options.headers["Content-Length"] = Buffer.byteLength(JSON.stringify(body));
    }

    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        const latency = Date.now() - start;
        stats.totalRequests++;
        stats.latencies.push(latency);
        if (stats.latencies.length > 500) stats.latencies.shift();

        if (res.statusCode >= 200 && res.statusCode < 400) {
          stats.successfulRequests++;
          let json = null;
          try { json = JSON.parse(data); } catch {}
          resolve({ ok: true, status: res.statusCode, latency, data: json });
        } else {
          stats.failedRequests++;
          stats.errors.push(`[${res.statusCode}] ${method} ${path}: ${data.slice(0, 100)}`);
          if (stats.errors.length > 10) stats.errors.shift();
          resolve({ ok: false, status: res.statusCode, latency, error: data });
        }
      });
    });

    req.on("error", (err) => {
      const latency = Date.now() - start;
      stats.totalRequests++;
      stats.failedRequests++;
      stats.errors.push(`[NET_ERR] ${method} ${path}: ${err.message}`);
      if (stats.errors.length > 10) stats.errors.shift();
      resolve({ ok: false, status: 0, latency, error: err.message });
    });

    req.on("timeout", () => {
      req.destroy();
      const latency = Date.now() - start;
      stats.totalRequests++;
      stats.failedRequests++;
      stats.errors.push(`[TIMEOUT] ${method} ${path} after 10s`);
      if (stats.errors.length > 10) stats.errors.shift();
      resolve({ ok: false, status: 408, latency, error: "Request Timeout" });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simulated Participant Worker
async function runUserWorker(userId) {
  const teamName = `SIM-Team-${String(userId).padStart(2, "0")}`;
  const teamEmail = `sim.user.${userId}@entropy.test`;
  let currentTeam = null;

  while (Date.now() < stats.endTime) {
    try {
      // 1. Authenticate / Login Team (or re-authenticate)
      if (!currentTeam || Math.random() < 0.15) {
        const authRes = await makeRequest("POST", "/api/teams", {
          name: teamName,
          email: teamEmail,
        });
        stats.actions.teamAuth++;
        if (authRes.ok && authRes.data?.team) {
          currentTeam = authRes.data.team;
        }
        await sleep(1000 + Math.random() * 2000);
      }

      if (!currentTeam) {
        await sleep(3000);
        continue;
      }

      // 2. Refresh & View Leaderboard (Common action)
      await makeRequest("GET", "/api/leaderboard");
      stats.actions.leaderboardViews++;
      await sleep(1500 + Math.random() * 3000);

      // 3. Submit a Bug Report (Core action)
      if (Math.random() < 0.75) {
        const bug = BUG_POOL[Math.floor(Math.random() * BUG_POOL.length)];
        const subRes = await makeRequest("POST", "/api/submissions", {
          teamId: currentTeam.id,
          description: `[Simulation ${new Date().toLocaleTimeString()}] ${bug.description}`,
          codeSnippet: bug.codeSnippet,
          screenshotUrl: null,
        });
        stats.actions.submissions++;
        await sleep(2000 + Math.random() * 3000);
      }

      // 4. View "My Submissions"
      await makeRequest("GET", `/api/submissions?teamId=${currentTeam.id}`);
      stats.actions.submissionsList++;
      await sleep(1500 + Math.random() * 2500);

      // 5. Check Treasure Vault
      if (Math.random() < 0.4) {
        await makeRequest("GET", "/api/treasures");
        stats.actions.treasureViews++;
        await sleep(1500 + Math.random() * 2000);
      }

      // Random jitter before next action loop (2 to 5 seconds)
      await sleep(2000 + Math.random() * 3000);
    } catch (err) {
      await sleep(3000);
    }
  }
}

// Live Terminal Telemetry Renderer
function renderDashboard() {
  const elapsedMs = Date.now() - stats.startTime;
  const remainingMs = Math.max(0, stats.endTime - Date.now());

  const elapsedMins = Math.floor(elapsedMs / 60000);
  const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);

  const remMins = Math.floor(remainingMs / 60000);
  const remSecs = Math.floor((remainingMs % 60000) / 1000);

  const avgLatency = stats.latencies.length > 0
    ? Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length)
    : 0;

  const minLatency = stats.latencies.length > 0 ? Math.min(...stats.latencies) : 0;
  const maxLatency = stats.latencies.length > 0 ? Math.max(...stats.latencies) : 0;

  const successRate = stats.totalRequests > 0
    ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)
    : "100.0";

  const progressPercent = Math.min(100, Math.round((elapsedMs / DURATION_MS) * 100));

  console.clear();
  console.log("================================================================================");
  console.log(" 🚀 ENTROPY QA PORTAL - 20-MINUTE 10-PERSON LIVE STRESS SIMULATION");
  console.log("================================================================================");
  console.log(` Target Endpoint:     ${TARGET_URL}`);
  console.log(` Active Persons:      ${NUM_USERS} concurrent simulated participants`);
  console.log(` Elapsed / Total:     ${elapsedMins}m ${elapsedSecs}s / ${DURATION_MINUTES}m 00s (${progressPercent}% complete)`);
  console.log(` Time Remaining:      ${remMins}m ${remSecs}s`);
  console.log("--------------------------------------------------------------------------------");
  console.log(` Total Requests Sent: ${stats.totalRequests.toLocaleString()}`);
  console.log(` Successful (200 OK): ${stats.successfulRequests.toLocaleString()} (${successRate}%)`);
  console.log(` Failed / Dropped:    ${stats.failedRequests.toLocaleString()}`);
  console.log(` Average Latency:     ${avgLatency} ms (Min: ${minLatency}ms | Max: ${maxLatency}ms)`);
  console.log("--------------------------------------------------------------------------------");
  console.log(" Participant Actions Breakdown:");
  console.log(`   • Bug Reports Submitted:     ${stats.actions.submissions.toLocaleString()}`);
  console.log(`   • Leaderboard Refreshes:     ${stats.actions.leaderboardViews.toLocaleString()}`);
  console.log(`   • Team Logins / Auth:        ${stats.actions.teamAuth.toLocaleString()}`);
  console.log(`   • 'My Submissions' Checked:  ${stats.actions.submissionsList.toLocaleString()}`);
  console.log(`   • Treasure Vault Inspects:   ${stats.actions.treasureViews.toLocaleString()}`);
  console.log("--------------------------------------------------------------------------------");
  if (stats.errors.length > 0) {
    console.log(" ⚠️ Recent Errors / Slow Responses:");
    stats.errors.slice(-3).forEach((e) => console.log(`   - ${e}`));
  } else {
    console.log(" 🟢 HEALTH STATUS: 100% HEALTHY - Zero dropped requests. Zero website lag.");
  }
  console.log("================================================================================");
  console.log(" 💡 You can open the portal in your browser right now and monitor live!");
  console.log("    Press Ctrl+C at any time to stop the simulation early.");
  console.log("================================================================================");
}

async function main() {
  console.log(`\nStarting ${NUM_USERS}-person stress simulation on ${TARGET_URL} for ${DURATION_MINUTES} minutes...`);

  // Start all concurrent virtual user workers
  const workers = [];
  for (let i = 1; i <= NUM_USERS; i++) {
    workers.push(runUserWorker(i));
  }

  // Dashboard refresh interval (every 2.5 seconds)
  const dashboardInterval = setInterval(renderDashboard, 2500);

  // Wait for all workers to finish duration
  await Promise.all(workers);

  clearInterval(dashboardInterval);
  renderDashboard();

  console.log("\n✅ 20-Minute Simulation Completed Successfully!");
  console.log(`Total Requests: ${stats.totalRequests} | Success: ${stats.successfulRequests} | Failed: ${stats.failedRequests}`);
  console.log("To clean up simulated test data, run: node scripts/cleanup-simulation.js\n");
}

main().catch((err) => {
  console.error("Simulation runner encountered error:", err);
  process.exit(1);
});
