async function testAll() {
  const base = 'http://localhost:3001';

  // 1. Check treasures
  const tRes = await fetch(base + '/api/treasures').then((r) => r.json());
  console.log('1. Treasures total:', tRes.total, 'Remaining:', tRes.remainingCount);

  // 2. Check bugs
  const bRes = await fetch(base + '/api/bugs').then((r) => r.json());
  console.log('2. Master bugs total:', bRes.totalCount);

  // 3. Register team
  const teamRes = await fetch(base + '/api/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alpha Squad', email: 'alpha@entropy.qa' }),
  }).then((r) => r.json());
  console.log('3. Team authenticated:', teamRes.team.name, 'ID:', teamRes.team.id);

  // 4. Submit a bug report for Easy 1 (Navbar logo routing)
  const subRes = await fetch(base + '/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: teamRes.team.id,
      description: 'Clicking the header logo on catalog page redirects to /about instead of homepage /',
      codeSnippet: '<Link href="/about"><BrandLogo /></Link>',
    }),
  }).then((r) => r.json());
  console.log('4. Bug submitted:', subRes.submission.id, 'Status:', subRes.submission.status);

  // 5. Judge approves bug (with judge PIN header)
  const judgeRes = await fetch(base + '/api/submissions/' + subRes.submission.id + '/judge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-judge-auth': 'laal_wala_AngryBird' },
    body: JSON.stringify({
      status: 'VERIFIED',
      matchedBugId: 'EASY-01',
      judgeNotes: 'Verified reproduction via inspector.',
    }),
  }).then((r) => r.json());
  console.log('5. Judge verdict:', judgeRes.submission.status, 'Points:', judgeRes.submission.awardedPoints, 'SpeedBonus:', judgeRes.submission.isSpeedBonus);

  // 6. Redeem a treasure flag
  const claimRes = await fetch(base + '/api/treasures/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: teamRes.team.id,
      code: 'FLAG{7_clicks_unlocked_secret_treasure}',
    }),
  }).then((r) => r.json());
  console.log('6. Treasure flag redeemed:', claimRes.message, 'New score:', claimRes.newTotalScore);

  // 7. Check leaderboard
  const leadRes = await fetch(base + '/api/leaderboard').then((r) => r.json());
  console.log('7. Leaderboard Top 1:', leadRes.leaderboard[0].name, 'Score:', leadRes.leaderboard[0].totalScore, 'Treasures:', leadRes.leaderboard[0].treasuresClaimedCount);
}

testAll().catch(console.error);
