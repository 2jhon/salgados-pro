-- Instructions for the user:
--
-- Hello! This file contains the exact SQL command you need to fix the "TypeError | Msg: Failed to fetch"
-- error that is happening because Ad-blockers (like uBlock Origin, Adblock Plus, or Brave Browser)
-- block any network request containing the word "ads" in its URL (such as "/rest/v1/ads").
--
-- To prevent ad-blockers from blocking your ads table functionality, we need to rename the table
-- from `ads` to `app_banners` in your Supabase database.
--
-- Go to your Supabase project -> SQL Editor, and run the following commands:

ALTER TABLE IF EXISTS "public"."ads" RENAME TO "app_banners";
NOTIFY pgrst, 'reload schema';

-- Once you've successfully run this command in Supabase, your ads features will work perfectly!
-- You will also need to rename the `ads` storage bucket to `app_banners` in your Supabase Storage settings if you use storage!
