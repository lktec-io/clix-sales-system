-- 016_add_preferred_language_to_users.sql
-- Adds a per-user language preference (English/Kiswahili) so the UI
-- language follows the account across devices — localStorage alone would
-- only remember the choice on the device it was made on. Non-destructive:
-- every existing user defaults to 'en', matching the app's current
-- English-only behavior, so no existing session/user is affected.

ALTER TABLE users ADD COLUMN preferred_language ENUM('en','sw') NOT NULL DEFAULT 'en' AFTER avatar_path;
