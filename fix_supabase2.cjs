const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /const supabaseServiceKey = process\.env\.SUPABASE_SERVICE_ROLE_KEY \|\| 'eyJhbG/,
  "const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbG"
);

fs.writeFileSync('server.ts', code);
