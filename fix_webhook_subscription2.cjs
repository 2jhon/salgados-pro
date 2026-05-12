const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /await supabase\.from\('store_profiles'\)\.update\(\{/g,
  "await supabase.from('users').update({"
);

// We should replace .eq('workspace_id', workspaceId) with .eq('id', userId) 
// for the subscription part. Let's do it safely.
code = code.replace(
  /if \(workspaceId\) \{\s*const now = new Date\(\);\s*const expires = new Date\(now\.getFullYear\(\), now\.getMonth\(\) \+ 1, now\.getDate\(\)\)\.toISOString\(\);\s*await supabase\.from\('users'\)\.update\(\{\s*pro_expires_at: expires,\s*ad_free_expires_at: expires\s*\}\)\.eq\('workspace_id', workspaceId\);\s*\}/,
  "const now = new Date();\n        const expires = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();\n        await supabase.from('users').update({ pro_expires_at: expires, ad_free_expires_at: expires, active_plan_id: planId, advertiser_expires_at: expires }).eq('id', userId);\n"
);

fs.writeFileSync('server.ts', code);
