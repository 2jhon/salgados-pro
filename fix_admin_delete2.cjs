const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(
  "const tables = ['transactions', 'inventory', 'notes', 'ads', 'app_banners', 'customers', 'reports', 'app_config', 'store_profiles', 'users'];",
  `
      // Buscar uids para excluir da auth antes de apagar a tabela users
      const { data: usersToKill } = await supabase.from('users').select('auth_id').eq('workspace_id', workspaceId);
      if (usersToKill && usersToKill.length > 0) {
         for (const u of usersToKill) {
            if (u.auth_id) {
               await supabase.auth.admin.deleteUser(u.auth_id).catch(() => {});
            }
         }
      }
      
      const tables = ['transactions', 'inventory', 'notes', 'ads', 'app_banners', 'customers', 'reports', 'app_config', 'store_profiles', 'users'];`
);
fs.writeFileSync('server.ts', serverCode);
