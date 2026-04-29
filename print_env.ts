import "dotenv/config";
const parseJwt = (token: string) => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  } catch (e) {
    return null;
  }
};
console.log(Object.keys(process.env).filter(k => k.includes('SUPABASE')));
const keys = Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('KEY') || k.includes('TOKEN'));
for (const key of keys) {
  const v = process.env[key];
  if (v && v.startsWith('ey')) {
    const dec = parseJwt(v);
    console.log(`${key} exp:`, dec?.exp);
  }
}


