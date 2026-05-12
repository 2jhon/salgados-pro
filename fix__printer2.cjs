const fs = require('fs');
let content = fs.readFileSync('lib/printer.ts', 'utf8');
content = content.replace(
  /if \(error && error\.message && error\.message\.includes\('User cancelled'\)\) \{/,
  "const errMsg = error?.message || String(error);\n      if (errMsg.includes('User cancelled') || errMsg.includes('CANCELLED')) {"
);
fs.writeFileSync('lib/printer.ts', content);
