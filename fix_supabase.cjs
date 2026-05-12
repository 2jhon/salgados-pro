const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /const supabaseUrl = 'https:\/\/vvxvwntjwjzalzjiwrmm\.supabase\.co';/,
  "const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vvxvwntjwjzalzjiwrmm.supabase.co';"
);

fs.writeFileSync('server.ts', code);
