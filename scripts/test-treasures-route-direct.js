async function test() {
  const mod = require('../.next/server/app/api/treasures/route.js');
  console.log('Module keys:', Object.keys(mod));
  const res = await mod.routeModule.handle(new Request('http://localhost:3001/api/treasures'));
  console.log('Response status:', res.status);
  const data = await res.json();
  console.log('Data:', data);
}

test().catch(console.error);
