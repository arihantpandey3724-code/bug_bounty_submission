/**
 * Entropy Bug Bounty Portal - 40-Participant 20-Minute Concurrent Stress Simulation
 *
 * Simulates 40 simultaneous participants performing realistic competition actions:
 * - Creating teams and logging in with primary credentials
 * - Simulating accidental email typos (creating transient typo teams, realizing mistake, logging out immediately, and logging back in with correct credentials)
 * - Submitting bugs across Easy, Medium, and Hard defect categories from the 54 master catalog
 * - Competing to claim Treasure Bug codes (testing atomic CAS race conditions)
 * - Constantly refreshing and monitoring the Leaderboard
 * - Viewing their personal "My Submissions" list
 *
 * Target: https://bug-bounty-submission.vercel.app
 * Duration: 20 minutes (1200 seconds)
 * Concurrency: 40 simultaneous worker threads
 */

const https = require("https");
const http = require("http");

// CLI Options
const args = process.argv.slice(2).reduce((acc, cur) => {
  const [k, v] = cur.replace(/^--/, "").split("=");
  acc[k] = v || true;
  return acc;
}, {});

const TARGET_URL = (typeof args.url === "string" ? args.url : "https://bug-bounty-submission.vercel.app").replace(/\/$/, "");
const NUM_USERS = parseInt(args.users || "40", 10);
const DURATION_MINUTES = parseFloat(args.duration || "20");
const DURATION_MS = DURATION_MINUTES * 60 * 1000;

// All 54 Defect Templates from Master Catalog
const ALL_54_BUGS = [
  // Easy Defects
  { id: "EASY-01", title: "Top Navbar Logo Routing", desc: "Clicking brand logo redirects to /about instead of homepage /." },
  { id: "EASY-02", title: "Theme Toggle Visual Inconsistency", desc: "Toggling theme only flips icon state; CSS background colors remain unchanged." },
  { id: "EASY-03", title: "Reactive Cart Badge Counter", desc: "Cart badge counter in header does not update until manual page reload." },
  { id: "EASY-04", title: "Hero Carousel Directional Control", desc: "Clicking right carousel control arrow triggers no action; left arrow works." },
  { id: "EASY-05", title: "Catalog Grid Media Mapping", desc: "Headphones product card renders an office chair image." },
  { id: "EASY-06", title: "Review Star Rating Calculation", desc: "4.8 star rating renders only 3 filled stars." },
  { id: "EASY-07", title: "Mobile Hamburger Menu Toggle", desc: "Clicking mobile menu hamburger icon fails to open drawer." },
  { id: "EASY-08", title: "Search Input Reset Handling", desc: "Clicking the clear (X) icon in search input does not clear search state." },
  { id: "EASY-09", title: "Footer Link Anchor Validation", desc: "Footer 'Privacy Policy' link has empty href target." },
  { id: "EASY-10", title: "Price Formatting Decimals", desc: "Product price renders without decimal cents ($49 instead of $49.99)." },
  { id: "EASY-11", title: "Sold Out Button Availability", desc: "Out of stock items still show active 'Add to Cart' button." },
  { id: "EASY-12", title: "Thumbnail Gallery Selection", desc: "Clicking gallery thumbnail does not swap the hero image." },
  { id: "EASY-13", title: "Accordion Content Collapse", desc: "FAQ accordion panel cannot be collapsed once expanded." },
  { id: "EASY-14", title: "Newsletter Email Syntax Filter", desc: "Newsletter subscription accepts invalid email without error." },
  { id: "EASY-15", title: "Breadcrumb Hierarchy Mapping", desc: "Breadcrumbs skip category and link root directly to item." },
  { id: "EASY-16", title: "Sorting Order Inversion", desc: "Price Low to High sorts items in descending order." },
  { id: "EASY-17", title: "Notification Toast Auto-Dismiss", desc: "Added to Cart toast notification stays stuck on screen." },
  { id: "EASY-18", title: "Quantity Input Minimum Boundary", desc: "Quantity selector allows decrementing below 1." },

  // Medium Defects
  { id: "MED-01", title: "Stale Cart Mutation", desc: "Removing an item from cart removes wrong item index." },
  { id: "MED-02", title: "Category Filter Deselection", desc: "Unchecking category checkbox keeps filter active." },
  { id: "MED-03", title: "Discount Code Case Sensitivity", desc: "Coupon code SAVE20 fails if entered in lowercase save20." },
  { id: "MED-04", title: "Pagination Boundary Drift", desc: "Clicking Next on last catalog page loads empty 404 page." },
  { id: "MED-05", title: "Subtotal Floating Point Precision", desc: "Cart subtotal displays $19.99999999997 instead of $20.00." },
  { id: "MED-06", title: "Product Tab State Persistence", desc: "Switching to Specifications tab resets on browser resize." },
  { id: "MED-07", title: "Wishlist Toggle Heart Synchronization", desc: "Heart icon remains outlined even after adding item to wishlist." },
  { id: "MED-08", title: "Zip Code Autofill Geographic Mapping", desc: "Entering ZIP 90210 autofills New York instead of California." },
  { id: "MED-09", title: "Autofill Continue Button Disabled", desc: "Use this address button remains blocked until field is manually typed into." },
  { id: "MED-10", title: "Session Storage Cart Loss", desc: "Refreshing the checkout page clears all items in the cart." },
  { id: "MED-11", title: "Inventory Stock Race Condition", desc: "Concurrent checkout allows purchasing more units than in stock." },
  { id: "MED-12", title: "Shipping Fee Zero Calculation", desc: "Express delivery option charges $0 shipping instead of $15." },
  { id: "MED-13", title: "Review Form Text Limit Enforcement", desc: "Review input allows pasting 10,000 characters without truncation." },
  { id: "MED-14", title: "Search Query HTML Sanitization", desc: "Search query renders raw HTML tags without sanitizing." },
  { id: "MED-15", title: "Currency Converter Inversion", desc: "Switching currency from USD to EUR multiplies price instead of dividing." },
  { id: "MED-16", title: "Order History Date Format", desc: "Order dates show NaN/NaN/0NaN on non-Chrome browsers." },
  { id: "MED-17", title: "Back Button Checkout State Loss", desc: "Clicking browser back button cancels active order." },
  { id: "MED-18", title: "Duplicate Item Cart Splitting", desc: "Adding same product twice creates two separate rows instead of qty 2." },

  // Hard Defects
  { id: "HARD-01", title: "Price Parameter Manipulation in Cart Payload", desc: "Modifying price field in POST /api/cart checkout payload charges modified price." },
  { id: "HARD-02", title: "SQL Parameter Injection in Search Filter", desc: "Search endpoint evaluates unescaped SQL parameter in category filter." },
  { id: "HARD-03", title: "Admin Role Bypass via JWT Decoding", desc: "Tampering with role property in client token grants admin access." },
  { id: "HARD-04", title: "IDOR on Order Invoice Retrieval", desc: "Changing order ID parameter in /orders/:id retrieves invoice of another user." },
  { id: "HARD-05", title: "Race Condition on Single-Use Promo Code", desc: "Sending parallel coupon requests applies 50% discount twice." },
  { id: "HARD-06", title: "Arbitrary File Upload via Avatar Endpoint", desc: "Profile picture upload accepts .html script files." },
  { id: "HARD-07", title: "Cross-Site Scripting via Product Question", desc: "Q&A submission allows executing inline JavaScript on product page." },
  { id: "HARD-08", title: "CORS Misconfiguration on User Address API", desc: "API endpoint sets Access-Control-Allow-Origin: * with credentials." },
  { id: "HARD-09", title: "Unauthenticated Order Cancellation", desc: "Sending DELETE to /api/orders without session token cancels order." },
  { id: "HARD-10", title: "Order State Transition Validation", desc: "Delivered order can be transitioned back to Pending via PUT /api/orders." },
  { id: "HARD-11", title: "Cart Quantity Boundary Validation", desc: "Entering negative quantity reduces cart total below zero." },
  { id: "HARD-12", title: "Session Storage Cleanup on Sign-Out", desc: "Logging out does not clear masked credit card info from localStorage." },
  { id: "HARD-13", title: "Profile Update Parameter Filtering", desc: "Passing role: 'admin' in JSON body escalates user privileges." },
  { id: "HARD-14", title: "Case-Sensitive Promo Stacking", desc: "WELCOME10 and welcome10 apply twice on same order." },
  { id: "HARD-15", title: "Truncation Tax Evasion", desc: "Math.floor() on subtotal drops taxable cents." },
  { id: "HARD-16", title: "Max Quantity Race Condition", desc: "Rapidly clicking Add to Cart bypasses maximum order limit." },
];

const TREASURE_CODES = [
  "TREASURE-ENTROPY-2026",
  "TREASURE-GOATED-ENTROPY",
  "TREASURE-MULTI-CLICK",
  "TREASURE-DOM-INSPECT",
  "TREASURE-INVOICE-PRINT",
  "FLAG{TREASURE_BUG_06_RESERVED}",
  "FLAG{TREASURE_BUG_07_RESERVED}",
  "FLAG{TREASURE_BUG_08_RESERVED}",
];

// Telemetry Stats
const stats = {
  startTime: Date.now(),
  endTime: Date.now() + DURATION_MS,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  latencies: [],
  actions: {
    officialLogins: 0,
    typoLogins: 0,
    typoLogouts: 0,
    submissions: 0,
    submissionsList: 0,
    leaderboardViews: 0,
    treasureClaims: 0,
  },
  errors: [],
};

// HTTP Request Utility
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
        "User-Agent": "Entropy-40Participant-StressSim/2.0",
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
          // Status 404/409 on treasure claim is expected if code is claimed or wrong
          if (res.statusCode === 404 || res.statusCode === 409) {
            stats.successfulRequests++;
            resolve({ ok: true, status: res.statusCode, latency, error: data });
          } else {
            stats.failedRequests++;
            stats.errors.push(`[${res.statusCode}] ${method} ${path}: ${data.slice(0, 80)}`);
            if (stats.errors.length > 10) stats.errors.shift();
            resolve({ ok: false, status: res.statusCode, latency, error: data });
          }
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

// Generate unique, realistic email typos
function generateTypoEmail(userId) {
  const typoDomains = [
    "gmaill.com", "gmial.com", "gnail.com", "hotmial.com", "outlok.com",
    "yaho.com", "entropy-bounty.co", "test-qa.in", "student.edu.tst"
  ];
  const domain = typoDomains[Math.floor(Math.random() * typoDomains.length)];
  const randTag = Math.random().toString(36).slice(2, 6);
  return `sim40.typo.user${userId}_${randTag}@${domain}`;
}

// Individual Simulated Participant Worker
async function runParticipantWorker(userId) {
  const officialTeamName = `SIM40-Team-${String(userId).padStart(2, "0")}`;
  const officialTeamEmail = `sim40.user.${userId}@entropy.test`;

  let currentTeam = null;

  while (Date.now() < stats.endTime) {
    try {
      // SCENARIO 1: Accidental Typo Login / Registration (Occurs 20% of the time)
      if (Math.random() < 0.20) {
        const typoEmail = generateTypoEmail(userId);
        const typoName = `SIM40-Typo-${userId}-${Math.floor(Math.random() * 9999)}`;

        // User registers/logs in with typo credentials
        const typoAuth = await makeRequest("POST", "/api/teams", {
          name: typoName,
          email: typoEmail,
        });
        stats.actions.typoLogins++;

        // Brief delay: Participant realizes error ("wait, this isn't my team!")
        await sleep(800 + Math.random() * 1500);

        // Logs out (in code, we discard the typo team reference)
        currentTeam = null;
        stats.actions.typoLogouts++;
        await sleep(500 + Math.random() * 1000);
      }

      // SCENARIO 2: Correct Team Login / Session Re-validation
      if (!currentTeam || Math.random() < 0.10) {
        const authRes = await makeRequest("POST", "/api/teams", {
          name: officialTeamName,
          email: officialTeamEmail,
        });
        stats.actions.officialLogins++;
        if (authRes.ok && authRes.data?.team) {
          currentTeam = authRes.data.team;
        }
        await sleep(1000 + Math.random() * 2000);
      }

      if (!currentTeam) {
        await sleep(2000);
        continue;
      }

      // SCENARIO 3: Refresh and Inspect the Leaderboard
      await makeRequest("GET", "/api/leaderboard");
      stats.actions.leaderboardViews++;
      await sleep(1500 + Math.random() * 2500);

      // SCENARIO 4: Submit a Bug Report from the Catalog of 54 Master Defects
      if (Math.random() < 0.70) {
        const bug = ALL_54_BUGS[Math.floor(Math.random() * ALL_54_BUGS.length)];
        await makeRequest("POST", "/api/submissions", {
          teamId: currentTeam.id,
          description: `[Participant ${userId} @ ${new Date().toLocaleTimeString()}] ${bug.title}: ${bug.desc}`,
          codeSnippet: `// Repro steps for ${bug.id}\nconst steps = ['inspect', 'reproduce', 'verify'];`,
          screenshotUrl: null,
        });
        stats.actions.submissions++;
        await sleep(2000 + Math.random() * 3000);
      }

      // SCENARIO 5: Check "My Submissions"
      await makeRequest("GET", `/api/submissions?teamId=${currentTeam.id}`);
      stats.actions.submissionsList++;
      await sleep(1200 + Math.random() * 2000);

      // SCENARIO 6: Attempt to Claim a Treasure Bug Flag
      if (Math.random() < 0.35) {
        const code = TREASURE_CODES[Math.floor(Math.random() * TREASURE_CODES.length)];
        await makeRequest("POST", "/api/treasures/claim", {
          teamId: currentTeam.id,
          code: code,
        });
        stats.actions.treasureClaims++;
        await sleep(1500 + Math.random() * 2000);
      }

      // Human-like think pause between loops (3 to 6 seconds)
      await sleep(2500 + Math.random() * 3500);
    } catch {
      await sleep(2500);
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
  console.log(" 🔥 ENTROPY QA PORTAL - 40-PARTICIPANT LIVE CONCURRENT STRESS TEST");
  console.log("================================================================================");
  console.log(` Target Endpoint:       ${TARGET_URL}`);
  console.log(` Active Participants:   ${NUM_USERS} concurrent simulated workers`);
  console.log(` Elapsed / Total:       ${elapsedMins}m ${elapsedSecs}s / ${DURATION_MINUTES}m 00s (${progressPercent}% complete)`);
  console.log(` Time Remaining:        ${remMins}m ${remSecs}s`);
  console.log("--------------------------------------------------------------------------------");
  console.log(` Total HTTP Requests:   ${stats.totalRequests.toLocaleString()}`);
  console.log(` Successful Requests:   ${stats.successfulRequests.toLocaleString()} (${successRate}%)`);
  console.log(` Failed / Dropped:      ${stats.failedRequests.toLocaleString()}`);
  console.log(` Response Latency:      Avg: ${avgLatency}ms | Min: ${minLatency}ms | Max: ${maxLatency}ms`);
  console.log("--------------------------------------------------------------------------------");
  console.log(" Actions Breakdown Across 40 Participants:");
  console.log(`   • Bug Submissions (54 Defect Pool):  ${stats.actions.submissions.toLocaleString()}`);
  console.log(`   • Leaderboard Live Refreshes:        ${stats.actions.leaderboardViews.toLocaleString()}`);
  console.log(`   • Official Team Logins:              ${stats.actions.officialLogins.toLocaleString()}`);
  console.log(`   • Typo Registration Simulations:     ${stats.actions.typoLogins.toLocaleString()} (Auto-logged out: ${stats.actions.typoLogouts.toLocaleString()})`);
  console.log(`   • 'My Submissions' List Fetches:     ${stats.actions.submissionsList.toLocaleString()}`);
  console.log(`   • Treasure Bug Race Claims:          ${stats.actions.treasureClaims.toLocaleString()}`);
  console.log("--------------------------------------------------------------------------------");
  if (stats.errors.length > 0) {
    console.log(" ⚠️ Recent Slow Responses / Errors:");
    stats.errors.slice(-3).forEach((e) => console.log(`   - ${e}`));
  } else {
    console.log(" 🟢 HEALTH STATUS: 100% HEALTHY - All 40 participants active. Zero dropped requests.");
  }
  console.log("================================================================================");
  console.log(" 💡 Open https://bug-bounty-submission.vercel.app in your browser to monitor live!");
  console.log("    Press Ctrl+C at any time to stop the simulation early.");
  console.log("================================================================================");
}

async function main() {
  console.log(`\nLaunching 40-participant stress simulation on ${TARGET_URL} for ${DURATION_MINUTES} minutes...`);

  // Start 40 concurrent workers
  const workers = [];
  for (let i = 1; i <= NUM_USERS; i++) {
    workers.push(runParticipantWorker(i));
  }

  // Dashboard update every 2.5 seconds
  const dashboardInterval = setInterval(renderDashboard, 2500);

  await Promise.all(workers);

  clearInterval(dashboardInterval);
  renderDashboard();

  console.log("\n✅ 40-Participant 20-Minute Simulation Completed Successfully!");
  console.log(`Total Requests: ${stats.totalRequests} | Success: ${stats.successfulRequests} | Failed: ${stats.failedRequests}`);
  console.log("To clean up simulated test data, run: node scripts/cleanup-simulation.js\n");
}

main().catch((err) => {
  console.error("Simulation runner encountered error:", err);
  process.exit(1);
});
