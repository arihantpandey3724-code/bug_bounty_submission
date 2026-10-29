const baseUrl = 'http://localhost:3001';

async function runTests() {
  console.log('--- Starting Comprehensive Portal Start/Stop & Endpoint Audit ---');
  let cookie = '';

  // 1. Initial portal status
  console.log('\n[1] Check initial portal status:');
  const res1 = await fetch(`${baseUrl}/api/admin/portal-status`);
  const data1 = await res1.json();
  console.log('Status HTTP:', res1.status, JSON.stringify(data1));
  if (data1.submissionsOpen !== true) throw new Error('Expected submissionsOpen: true initially');

  // 2. Fetch a valid teamId for testing
  console.log('\n[2] Fetch valid team for testing:');
  const teamsRes = await fetch(`${baseUrl}/api/teams`);
  const teams = await teamsRes.json();
  const testTeam = teams[0] || { id: 'team-local-cyberknights' };
  console.log('Using test team:', testTeam.id, testTeam.name);

  // 3. Judge Login
  console.log('\n[3] Judge Login:');
  const loginRes = await fetch(`${baseUrl}/api/judge/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: 'laal_wala_AngryBird' })
  });
  console.log('Login HTTP:', loginRes.status);
  const setCookie = loginRes.headers.get('set-cookie');
  if (setCookie) {
    cookie = setCookie.split(';')[0];
    console.log('Obtained Judge Cookie:', cookie);
  } else {
    throw new Error('Failed to obtain judge cookie');
  }

  // 4. Pause portal as Judge
  console.log('\n[4] Pause submissions via Judge POST:');
  const pauseRes = await fetch(`${baseUrl}/api/admin/portal-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({ submissionsOpen: false })
  });
  const pauseData = await pauseRes.json();
  console.log('Pause HTTP:', pauseRes.status, JSON.stringify(pauseData));
  if (pauseData.submissionsOpen !== false) throw new Error('Failed to pause portal');

  // 5. Verify status is paused
  console.log('\n[5] Verify status endpoint returns submissionsOpen: false:');
  const res2 = await fetch(`${baseUrl}/api/admin/portal-status`);
  const data2 = await res2.json();
  console.log('Status HTTP:', res2.status, JSON.stringify(data2));
  if (data2.submissionsOpen !== false) throw new Error('Status not reflected as false');

  // 6. Test submission rejection when paused
  console.log('\n[6] Test participant submission while paused:');
  const subRejectRes = await fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: testTeam.id,
      description: 'Testing if submission is blocked while paused',
      codeSnippet: '// test snippet'
    })
  });
  const subRejectData = await subRejectRes.json();
  console.log('Submission HTTP:', subRejectRes.status, JSON.stringify(subRejectData));
  if (subRejectRes.status !== 403 || !subRejectData.error?.includes('paused')) {
    throw new Error('Submission was not rejected with 403 paused message');
  }
  console.log('✓ Verified: Submissions are properly gated and blocked with 403 when portal is paused.');

  // 7. Test unauthorized toggle attempt
  console.log('\n[7] Test unauthorized toggle attempt (no cookie):');
  const unauthRes = await fetch(`${baseUrl}/api/admin/portal-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionsOpen: true })
  });
  console.log('Unauthorized HTTP:', unauthRes.status);
  if (unauthRes.status !== 401) throw new Error('Unauthorized request was not rejected with 401');
  console.log('✓ Verified: Unauthorized users cannot toggle portal status.');

  // 8. Reopen portal as Judge
  console.log('\n[8] Reopen submissions via Judge POST:');
  const reopenRes = await fetch(`${baseUrl}/api/admin/portal-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({ submissionsOpen: true })
  });
  const reopenData = await reopenRes.json();
  console.log('Reopen HTTP:', reopenRes.status, JSON.stringify(reopenData));
  if (reopenData.submissionsOpen !== true) throw new Error('Failed to reopen portal');

  // 9. Verify status is reopened
  console.log('\n[9] Verify status endpoint returns submissionsOpen: true:');
  const res3 = await fetch(`${baseUrl}/api/admin/portal-status`);
  const data3 = await res3.json();
  console.log('Status HTTP:', res3.status, JSON.stringify(data3));
  if (data3.submissionsOpen !== true) throw new Error('Status not reflected as true');

  // 10. Test participant submission when reopened
  console.log('\n[10] Test participant submission when reopened:');
  const tStart = Date.now();
  const subAcceptRes = await fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: testTeam.id,
      description: 'The search suggestions dropdown in the header repeats duplicate query strings and clicking them navigates nowhere.',
      codeSnippet: '// SearchSuggestions.tsx bug'
    })
  });
  const duration = Date.now() - tStart;
  const subAcceptData = await subAcceptRes.json();
  console.log(`Submission HTTP: ${subAcceptRes.status} (${duration}ms)`, JSON.stringify(subAcceptData));
  if (subAcceptRes.status !== 200 || !subAcceptData.success) throw new Error('Submission failed after reopening portal');
  console.log('Submission Created At:', subAcceptData.submission?.createdAt);
  console.log('✓ Verified: Submissions work cleanly after reopening with accurate timestamp.');

  // 11. Audit Public Endpoints
  console.log('\n[11] Auditing public endpoints:');
  const publicEndpoints = [
    '/api/teams',
    '/api/leaderboard',
    '/api/treasures',
    '/api/admin/portal-status',
    '/submit',
    '/leaderboard',
    '/my-submissions',
    '/treasures',
    '/judge'
  ];

  for (const ep of publicEndpoints) {
    const t0 = Date.now();
    const r = await fetch(`${baseUrl}${ep}`);
    const elapsed = Date.now() - t0;
    console.log(`Endpoint ${ep.padEnd(26)} -> HTTP ${r.status} (${elapsed}ms)`);
    if (r.status !== 200) throw new Error(`Endpoint ${ep} returned status ${r.status}`);
  }

  // 12. Audit Judge-Protected Endpoints (with cookie)
  console.log('\n[12] Auditing judge-protected endpoints:');
  const judgeEndpoints = [
    '/api/bugs',
    '/api/submissions'
  ];

  for (const ep of judgeEndpoints) {
    const t0 = Date.now();
    const r = await fetch(`${baseUrl}${ep}`, {
      headers: { 'Cookie': cookie }
    });
    const elapsed = Date.now() - t0;
    console.log(`Judge Endpoint ${ep.padEnd(20)} -> HTTP ${r.status} (${elapsed}ms)`);
    if (r.status !== 200) throw new Error(`Judge endpoint ${ep} returned status ${r.status}`);
  }

  console.log('\n======================================================');
  console.log('🎉 AUDIT SUCCESSFUL: ALL ENDPOINTS & GATES ARE 100% OPERATIONAL!');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('\nFAILED TEST:', err);
  process.exit(1);
});
