async function poll() {
  console.log("Polling Vercel for new deployment...");
  for (let i = 1; i <= 20; i++) {
    try {
      const res = await fetch('https://bug-bounty-submission.vercel.app/api/stats?t=' + Date.now(), {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        console.log('✅ NEW VERCEL DEPLOYMENT LIVE!');
        console.log('Stats:', data);
        
        // Also fetch homepage
        const homeRes = await fetch('https://bug-bounty-submission.vercel.app/?t=' + Date.now(), {
          cache: 'no-store'
        });
        const html = await homeRes.text();
        const rfIdx = html.indexOf('Reports Filed');
        console.log('HOMEPAGE HTML:', html.slice(rfIdx - 40, rfIdx + 300));
        return;
      } else {
        console.log(`[Attempt ${i}/20] Status: ${res.status} (deploy in progress...)`);
      }
    } catch (e) {
      console.log(`[Attempt ${i}/20] Error:`, e.message);
    }
    await new Promise(r => setTimeout(r, 4000));
  }
}
poll().catch(console.error);
