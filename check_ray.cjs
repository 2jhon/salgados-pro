const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://vvxvwntjwjzalzjiwrmm.supabase.co', 'sb_publishable_xRQhm9rvVA2FTQUxgP8uDQ_Nwx4LwFQ');

async function checkAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, phone, role, access_code, auth_id, user_type');
  
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }
  
  console.log("All Users:", JSON.stringify(data, null, 2));
}

checkAllUsers();
