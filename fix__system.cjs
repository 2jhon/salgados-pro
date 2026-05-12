const fs = require('fs');
let content = fs.readFileSync('components/settings/SystemTab.tsx', 'utf8');
content = content.replace(
  /or err\.message\.includes\('User cancelled'\)/,
  "or err.message === 'USER_CANCELLED' || err.message.includes('User cancelled')"
);
fs.writeFileSync('components/settings/SystemTab.tsx', content);
