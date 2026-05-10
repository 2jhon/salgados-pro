import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envs = fs.readFileSync('.env.example', 'utf8');
const anonToken = envs.match(/VITE_SUPABASE_ANON_KEY=(.*)/)![1].trim();
let projId = anonToken.split('.')[1];
try { projId = JSON.parse(Buffer.from(projId, 'base64').toString()).ref; } catch(e){}
const url = `https://${projId}.supabase.co`;
const supabaseKey = envs.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)![1].trim();
const supabase = createClient(url, supabaseKey);
const sql = fs.readFileSync('fix_login_and_signup.sql', 'utf8');

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error('exec_sql error:', error);
    // Let's use the REST API manually if RPC fails
    console.log('Trying REST query directly due to missing exec_sql function');
    const res = await fetch(`${url}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({ query: sql })
    });
    console.log('Fallback Response:', await res.text());
  } else {
    console.log('Success:', data);
  }
}
run();
