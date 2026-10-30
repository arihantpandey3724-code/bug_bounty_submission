async function main() {
  const res = await fetch('http://localhost:3001/');
  const html = await res.text();
  const rfIdx = html.indexOf('Reports Filed');
  console.log('LOCALHOST 3001:');
  console.log(html.slice(rfIdx - 50, rfIdx + 1000));
}
main().catch(console.error);
