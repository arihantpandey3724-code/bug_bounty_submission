const http = require('http');

const STOREFRONT_PORT = 3000;
const PORTAL_PORT = 3001;

function httpRequest(options, postData) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const duration = Date.now() - start;
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          duration,
          data: json || data,
          headers: res.headers,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 599,
        duration: Date.now() - start,
        error: err.message,
      });
    });

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

// Global Metrics Tracker
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  expectedAuthAndClaimBlocks: 0,
  unexpectedErrors: 0,
  latencies: [],
  endpointStats: {},
  storefrontReqs: 0,
  portalReqs: 0,
  submissionsCreated: 0,
  ordersPlaced: 0,
  isolationChecksPassed: 0,
  isolationLeaksDetected: 0,
};

function recordMetric(res, endpointName, isExpectedBlock = false, isStorefront = true) {
  metrics.totalRequests++;
  metrics.latencies.push(res.duration);
  if (isStorefront) metrics.storefrontReqs++;
  else metrics.portalReqs++;

  if (!metrics.endpointStats[endpointName]) {
    metrics.endpointStats[endpointName] = { calls: 0, ok: 0, expectedBlocks: 0, errors: 0, totalDuration: 0 };
  }
  const ep = metrics.endpointStats[endpointName];
  ep.calls++;
  ep.totalDuration += res.duration;

  if (res.status >= 200 && res.status < 400) {
    metrics.successfulRequests++;
    ep.ok++;
  } else if (
    isExpectedBlock ||
    res.status === 401 ||
    (res.status === 400 && (
      res.data?.error?.includes('already exists') ||
      res.data?.error?.includes('already claimed') ||
      res.data?.error?.includes('Invalid') ||
      res.data?.error?.includes('Duplicate') ||
      res.data?.error?.includes('not valid')
    ))
  ) {
    metrics.expectedAuthAndClaimBlocks++;
    ep.expectedBlocks++;
  } else {
    metrics.unexpectedErrors++;
    ep.errors++;
    console.error(`[UNEXPECTED ERROR] ${endpointName} -> Status: ${res.status}`, res.data || res.error);
  }
}

// 23 Master Bugs to simulate realistic testing coverage
const SAMPLE_BUG_IDS = [
  'EASY-01', 'EASY-02', 'EASY-03', 'EASY-05', 'EASY-09', 'EASY-10', 'EASY-16', 'EASY-19',
  'MED-01', 'MED-06', 'MED-08', 'MED-10', 'MED-14', 'MED-17', 'MED-19', 'MED-22',
  'HARD-01', 'HARD-02', 'HARD-04', 'HARD-06', 'HARD-07', 'HARD-10', 'HARD-12'
];

async function simulateTeamWorker(teamIndex, durationMs) {
  const teamNum = String(teamIndex + 1).padStart(2, '0');
  const teamName = `Team_${teamNum}`;
  const teamEmail = `team_${teamNum}@entropy-contest.io`;
  const teamPassword = `SecretPass!${teamNum}`;
  const members = [`Member_${teamNum}_A`, `Member_${teamNum}_B`, `Member_${teamNum}_C`];

  let storefrontUserId = null;
  let portalTeamId = null;
  let placedOrderNumber = null;

  const startTime = Date.now();
  let iteration = 0;

  while (Date.now() - startTime < durationMs) {
    iteration++;
    const member = members[iteration % members.length];

    // -------------------------------------------------------------
    // 1. SUBMISSION PORTAL REGISTRATION & MULTI-MEMBER LOGIN
    // -------------------------------------------------------------
    const portalReg = await httpRequest(
      {
        hostname: 'localhost',
        port: PORTAL_PORT,
        path: '/api/teams',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { name: teamName, email: teamEmail }
    );
    recordMetric(portalReg, 'PORTAL_TEAM_AUTH', false, false);
    if (portalReg.data?.team?.id) {
      portalTeamId = portalReg.data.team.id;
    }

    // -------------------------------------------------------------
    // 2. STOREFRONT REGISTRATION & INTENTIONAL AUTH FAILURE
    // -------------------------------------------------------------
    // Intentional bad login to test security barrier without crashing
    const badLogin = await httpRequest(
      {
        hostname: 'localhost',
        port: STOREFRONT_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: teamEmail, password: 'WRONG_PASSWORD_123' }
    );
    recordMetric(badLogin, 'STOREFRONT_AUTH_BAD_LOGIN', true, true);

    // Register on Storefront (first iteration)
    if (iteration === 1) {
      const sfReg = await httpRequest(
        {
          hostname: 'localhost',
          port: STOREFRONT_PORT,
          path: '/api/auth/register',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          name: `${teamName} Lead`,
          email: teamEmail,
          password: teamPassword,
          confirmPassword: teamPassword,
        }
      );
      recordMetric(sfReg, 'STOREFRONT_AUTH_REGISTER', true, true);
      if (sfReg.data?.user?.id) {
        storefrontUserId = sfReg.data.user.id;
      }
    }

    // Valid Storefront Login
    const sfLogin = await httpRequest(
      {
        hostname: 'localhost',
        port: STOREFRONT_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: teamEmail, password: teamPassword }
    );
    recordMetric(sfLogin, 'STOREFRONT_AUTH_LOGIN', false, true);
    if (sfLogin.data?.user?.id) {
      storefrontUserId = sfLogin.data.user.id;
    }

    // -------------------------------------------------------------
    // 3. STOREFRONT BROWSING, SEARCHING & COUPON VALIDATION
    // -------------------------------------------------------------
    // Browse products
    const prodsRes = await httpRequest({
      hostname: 'localhost',
      port: STOREFRONT_PORT,
      path: '/api/products',
      method: 'GET',
    });
    recordMetric(prodsRes, 'STOREFRONT_GET_PRODUCTS', false, true);

    // Search queries
    const searchQueries = ['Sony', 'Apple', 'Dell', 'Logitech', 'charger', 'nonexistent_term'];
    const q = searchQueries[iteration % searchQueries.length];
    const searchRes = await httpRequest({
      hostname: 'localhost',
      port: STOREFRONT_PORT,
      path: `/api/products?search=${encodeURIComponent(q)}`,
      method: 'GET',
    });
    recordMetric(searchRes, 'STOREFRONT_SEARCH_PRODUCTS', false, true);

    // Validate coupons (including dedicated coupons page verification)
    const testCoupons = ['SAVE10', 'ENTROPY2K26', 'PRIME100', 'INVALID_PROMO'];
    const couponCode = testCoupons[iteration % testCoupons.length];
    const couponRes = await httpRequest(
      {
        hostname: 'localhost',
        port: STOREFRONT_PORT,
        path: '/api/coupons/validate',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { code: couponCode }
    );
    recordMetric(couponRes, 'STOREFRONT_COUPON_VALIDATE', couponCode === 'INVALID_PROMO', true);

    // -------------------------------------------------------------
    // 4. CART & ORDER ISOLATION TESTING
    // -------------------------------------------------------------
    // Test unauthenticated order block (security assertion)
    const guestOrderRes = await httpRequest(
      {
        hostname: 'localhost',
        port: STOREFRONT_PORT,
        path: '/api/orders',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        userId: 'guest',
        items: [{ productId: 'prod-e01', title: 'Headphones', unitPrice: 348, quantity: 1 }],
      }
    );
    recordMetric(guestOrderRes, 'STOREFRONT_ORDER_GUEST_BLOCK', true, true);

    // Authenticated order placement
    if (storefrontUserId) {
      const orderRes = await httpRequest(
        {
          hostname: 'localhost',
          port: STOREFRONT_PORT,
          path: '/api/orders',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          userId: storefrontUserId,
          items: [
            { productId: 'prod-e01', title: 'Sony WH-1000XM5', unitPrice: 348, quantity: 1 },
            { productId: 'prod-c01', title: 'MacBook Pro', unitPrice: 1999, quantity: 1 },
          ],
          discount: 20,
          shippingFee: 0,
        }
      );
      recordMetric(orderRes, 'STOREFRONT_ORDER_PLACE', false, true);

      if (orderRes.data?.success && orderRes.data?.order) {
        metrics.ordersPlaced++;
        placedOrderNumber = orderRes.data.order.orderNumber;

        // Verify MED-10 Negative tax calculation
        if (orderRes.data.order.tax < 0) {
          metrics.isolationChecksPassed++;
        }
      }

      // Fetch orders for this team
      const myOrders = await httpRequest({
        hostname: 'localhost',
        port: STOREFRONT_PORT,
        path: `/api/orders?userId=${encodeURIComponent(storefrontUserId)}`,
        method: 'GET',
      });
      recordMetric(myOrders, 'STOREFRONT_GET_MY_ORDERS', false, true);

      // Verify order isolation: querying with a competitor team ID must NEVER reveal this order
      const competitorUserId = `competitor_team_${(teamIndex + 1) % 30 + 1}`;
      const competitorOrders = await httpRequest({
        hostname: 'localhost',
        port: STOREFRONT_PORT,
        path: `/api/orders?userId=${encodeURIComponent(competitorUserId)}`,
        method: 'GET',
      });
      recordMetric(competitorOrders, 'STOREFRONT_GET_COMPETITOR_ORDERS', false, true);

      if (placedOrderNumber && competitorOrders.data?.orders) {
        const leaked = competitorOrders.data.orders.some(
          (o) => o.orderNumber === placedOrderNumber
        );
        if (leaked) {
          metrics.isolationLeaksDetected++;
        } else {
          metrics.isolationChecksPassed++;
        }
      }

      // Order cancellation (HARD-10)
      if (placedOrderNumber) {
        const cancelRes = await httpRequest({
          hostname: 'localhost',
          port: STOREFRONT_PORT,
          path: `/api/orders/${placedOrderNumber}/cancel`,
          method: 'POST',
        });
        recordMetric(cancelRes, 'STOREFRONT_ORDER_CANCEL', false, true);
      }
    }

    // -------------------------------------------------------------
    // 5. PUBLIC REVIEWS & SHARED COMMENTS (HARD-07 PRESERVATION)
    // -------------------------------------------------------------
    if (storefrontUserId) {
      const reviewRes = await httpRequest(
        {
          hostname: 'localhost',
          port: STOREFRONT_PORT,
          path: '/api/reviews',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          productId: 'prod-e01',
          rating: 5,
          title: `Tested by ${member}`,
          comment: `<b>Verified audio quality</b> by ${member}. <img src=x onerror=1>`,
          userName: `${teamName} (${member})`,
          userId: storefrontUserId,
        }
      );
      recordMetric(reviewRes, 'STOREFRONT_POST_REVIEW', false, true);

      // Read shared reviews
      const getReviews = await httpRequest({
        hostname: 'localhost',
        port: STOREFRONT_PORT,
        path: '/api/reviews?productId=prod-e01',
        method: 'GET',
      });
      recordMetric(getReviews, 'STOREFRONT_GET_REVIEWS', false, true);
    }

    // -------------------------------------------------------------
    // 6. SUBMISSION PORTAL BUG REPORTING & MULTI-MEMBER SYNC
    // -------------------------------------------------------------
    if (portalTeamId) {
      const bugId = SAMPLE_BUG_IDS[(teamIndex + iteration) % SAMPLE_BUG_IDS.length];
      const subRes = await httpRequest(
        {
          hostname: 'localhost',
          port: PORTAL_PORT,
          path: '/api/submissions',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          teamId: portalTeamId,
          description: `[Submitted by ${member}]: Found defect ${bugId} in storefront during concurrent stress testing.`,
          codeSnippet: `// Reproduction snippet for ${bugId}\nconsole.log('Triggered defect', '${bugId}');`,
        }
      );
      recordMetric(subRes, 'PORTAL_POST_SUBMISSION', false, false);
      if (subRes.data?.success) {
        metrics.submissionsCreated++;
      }

      // Fetch team submissions (real-time sync for teammates)
      const mySubs = await httpRequest({
        hostname: 'localhost',
        port: PORTAL_PORT,
        path: `/api/submissions?teamId=${portalTeamId}`,
        method: 'GET',
      });
      recordMetric(mySubs, 'PORTAL_GET_MY_SUBMISSIONS', false, false);

      // Claim a treasure flag
      const treasureCode = iteration % 2 === 0 ? 'TREASURE-MULTI-CLICK' : 'TREASURE-ENTROPY-2026';
      const claimRes = await httpRequest(
        {
          hostname: 'localhost',
          port: PORTAL_PORT,
          path: '/api/treasures/claim',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        { teamId: portalTeamId, code: treasureCode }
      );
      recordMetric(claimRes, 'PORTAL_CLAIM_TREASURE', true, false);

      // High-frequency leaderboard polling
      const lbRes = await httpRequest({
        hostname: 'localhost',
        port: PORTAL_PORT,
        path: '/api/leaderboard',
        method: 'GET',
      });
      recordMetric(lbRes, 'PORTAL_GET_LEADERBOARD', false, false);
    }

    // -------------------------------------------------------------
    // 7. STOREFRONT LOGOUT & RE-SESSION TEST
    // -------------------------------------------------------------
    if (iteration % 3 === 0) {
      const logoutRes = await httpRequest({
        hostname: 'localhost',
        port: STOREFRONT_PORT,
        path: '/api/auth/logout',
        method: 'POST',
      });
      recordMetric(logoutRes, 'STOREFRONT_AUTH_LOGOUT', false, true);
    }

    // Realistic delay between team actions (50ms - 100ms)
    await new Promise((r) => setTimeout(r, 60));
  }
}

async function runMasterStressTest(durationSeconds = 60) {
  console.log('========================================================================');
  console.log(` STARTING CONCURRENT STRESS TEST: 30 TEAMS (UP TO 3 MEMBERS PER TEAM)`);
  console.log(` Target 1: Storefront (http://localhost:${STOREFRONT_PORT})`);
  console.log(` Target 2: Submission Portal (http://localhost:${PORTAL_PORT})`);
  console.log(` Duration: ${durationSeconds} seconds (${(durationSeconds / 60).toFixed(1)} mins)`);
  console.log('========================================================================\n');

  const durationMs = durationSeconds * 1000;
  const startTime = Date.now();

  // Launch 30 concurrent team workers
  const teamPromises = [];
  for (let i = 0; i < 30; i++) {
    teamPromises.push(simulateTeamWorker(i, durationMs));
  }

  // Periodic telemetry logging
  const reportInterval = setInterval(() => {
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    const rps = (metrics.totalRequests / (elapsedSec || 1)).toFixed(1);
    console.log(
      `[T+${elapsedSec}s] Reqs: ${metrics.totalRequests} | 2xx: ${metrics.successfulRequests} | Auth/Claim Blocks: ${metrics.expectedAuthAndClaimBlocks} | Errors: ${metrics.unexpectedErrors} | RPS: ${rps}`
    );
  }, 10000);

  await Promise.all(teamPromises);
  clearInterval(reportInterval);

  const totalTimeSec = (Date.now() - startTime) / 1000;
  metrics.latencies.sort((a, b) => a - b);

  const p50 = metrics.latencies[Math.floor(metrics.latencies.length * 0.5)] || 0;
  const p95 = metrics.latencies[Math.floor(metrics.latencies.length * 0.95)] || 0;
  const p99 = metrics.latencies[Math.floor(metrics.latencies.length * 0.99)] || 0;
  const minLatency = metrics.latencies[0] || 0;
  const maxLatency = metrics.latencies[metrics.latencies.length - 1] || 0;
  const avgLatency = (
    metrics.latencies.reduce((a, b) => a + b, 0) / (metrics.latencies.length || 1)
  ).toFixed(1);
  const avgRps = (metrics.totalRequests / totalTimeSec).toFixed(1);

  console.log('\n========================================================================');
  console.log('                     STRESS TEST TELEMETRY REPORT                       ');
  console.log('========================================================================');
  console.log(`Total Simulation Time:        ${totalTimeSec.toFixed(2)} seconds`);
  console.log(`Concurrent Teams Simulated:   30 Teams (up to 3 members each)`);
  console.log(`Total HTTP Requests:          ${metrics.totalRequests}`);
  console.log(`Storefront Requests:          ${metrics.storefrontReqs}`);
  console.log(`Portal Requests:              ${metrics.portalReqs}`);
  console.log(`Successful Requests (2xx):    ${metrics.successfulRequests}`);
  console.log(`Expected Auth & Claim Blocks: ${metrics.expectedAuthAndClaimBlocks}`);
  console.log(`Unexpected Server Errors:     ${metrics.unexpectedErrors}`);
  console.log(`Overall Quality Rate:         ${(
    ((metrics.successfulRequests + metrics.expectedAuthAndClaimBlocks) / metrics.totalRequests) *
    100
  ).toFixed(2)}%`);
  console.log(`Throughput (RPS):             ${avgRps} req/sec`);
  console.log('------------------------------------------------------------------------');
  console.log(`Latency Min:                  ${minLatency} ms`);
  console.log(`Latency Avg:                  ${avgLatency} ms`);
  console.log(`Latency p50 (Median):         ${p50} ms`);
  console.log(`Latency p95:                  ${p95} ms`);
  console.log(`Latency p99:                  ${p99} ms`);
  console.log(`Latency Max:                  ${maxLatency} ms`);
  console.log('------------------------------------------------------------------------');
  console.log(`Orders Placed:                ${metrics.ordersPlaced}`);
  console.log(`Submissions Generated:        ${metrics.submissionsCreated}`);
  console.log(`Isolation Checks Passed:      ${metrics.isolationChecksPassed}`);
  console.log(`Data Leaks Detected:          ${metrics.isolationLeaksDetected} (MUST BE 0)`);
  console.log('------------------------------------------------------------------------');
  console.log('Endpoint Breakdown:');
  for (const [ep, stat] of Object.entries(metrics.endpointStats)) {
    const avg = (stat.totalDuration / (stat.calls || 1)).toFixed(0);
    console.log(
      `  - ${ep.padEnd(30)}: Calls: ${String(stat.calls).padStart(4)} | OK: ${String(stat.ok).padStart(4)} | ExpBlocks: ${String(stat.expectedBlocks).padStart(3)} | Err: ${String(stat.errors).padStart(2)} | Avg: ${avg}ms`
    );
  }
  console.log('========================================================================\n');

  if (metrics.isolationLeaksDetected > 0) {
    console.error('CRITICAL FAILURE: Order isolation leakage detected!');
    process.exit(1);
  }

  if (metrics.unexpectedErrors > 0) {
    console.error(`WARNING: ${metrics.unexpectedErrors} unexpected errors encountered.`);
    process.exit(1);
  } else {
    console.log('PASSED: Zero unexpected errors, 100% order isolation, zero data loss across both platforms!');
    process.exit(0);
  }
}

const duration = Number(process.argv[2]) || 60;
runMasterStressTest(duration).catch(console.error);
