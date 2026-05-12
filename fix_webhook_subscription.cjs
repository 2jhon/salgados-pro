const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /.from\('user_profiles'\)\n\s*.select\('workspace_id, company_id'\)\n\s*.eq\('id', userId\)/,
  ".from('users')\n        .select('workspace_id')\n        .eq('id', userId)"
);

code = code.replace(
  /const workspaceId = userProfile\?\.\[0\]\?\.company_id \|\| userProfile\?\.\[0\]\?\.workspace_id;/,
  "const workspaceId = userProfile?.[0]?.workspace_id;"
);

fs.writeFileSync('server.ts', code);
