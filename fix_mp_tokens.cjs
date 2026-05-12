const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /process\.env\.MP_ACCESS_TOKEN \|\| process\.env\.MERCADO_PAGO_ACCESS_TOKEN/g,
  "process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.VITE_MP_ACCESS_TOKEN"
);

code = code.replace(
  /const sellerAccessToken = storeProfile\.mp_access_token \|\| process\.env\.MP_ACCESS_TOKEN;/g,
  "const sellerAccessToken = storeProfile.mp_access_token || process.env.MP_ACCESS_TOKEN || process.env.VITE_MP_ACCESS_TOKEN;"
);

code = code.replace(
  /const accessToken = storeProfile\?\.mp_access_token \|\| process\.env\.MP_ACCESS_TOKEN;/g,
  "const accessToken = storeProfile?.mp_access_token || process.env.MP_ACCESS_TOKEN || process.env.VITE_MP_ACCESS_TOKEN;"
);

fs.writeFileSync('server.ts', code);
