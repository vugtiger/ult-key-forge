-- Remove duplicates first keeping the newest
DELETE FROM paste_multi_account_flags a
USING paste_multi_account_flags b
WHERE a.paste_id = b.paste_id 
  AND a.hwid = b.hwid 
  AND a.flagged_at < b.flagged_at;

-- Add unique constraint
ALTER TABLE paste_multi_account_flags 
  ADD CONSTRAINT paste_multi_account_flags_paste_hwid_unique UNIQUE (paste_id, hwid);