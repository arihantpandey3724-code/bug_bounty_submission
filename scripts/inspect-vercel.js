async function main() {
  const res = await fetch('https://bug-bounty-submission.vercel.app/');
  const html = await res.text();
  const rfIdx = html.indexOf('Reports Filed');
  console.log(html.slice(rfIdx - 50, rfIdx + 1000));
}
main().catch(console.error);
