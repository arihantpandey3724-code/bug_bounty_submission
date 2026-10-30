const fs = require('fs');
const content = fs.readFileSync('C:/Users/LENOVO/Documents/Extra Co-Curry/Bug_bounty/Submission_portal/.next/server/app/api/treasures/route.js', 'utf8');
const idx = content.indexOf('FROM "Treasure');
console.log(content.slice(idx, idx + 1000));
