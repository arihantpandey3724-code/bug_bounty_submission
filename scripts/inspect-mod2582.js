const fs = require('fs');
const content = fs.readFileSync('C:/Users/LENOVO/Documents/Extra Co-Curry/Bug_bounty/Submission_portal/.next/server/app/api/treasures/route.js', 'utf8');
const mod2582 = content.indexOf('2582:');
if (mod2582 !== -1) {
  console.log(content.slice(mod2582, mod2582 + 500));
} else {
  console.log('2582 not in this file, searching all chunks...');
}
