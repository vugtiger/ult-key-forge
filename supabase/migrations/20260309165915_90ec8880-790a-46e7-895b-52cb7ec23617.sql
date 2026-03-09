-- Unban all IPs that were wrongfully banned by spoofed_roblox_minimal_roblox_ua
UPDATE global_bans 
SET is_active = false 
WHERE reason LIKE '%spoofed_roblox_minimal_roblox_ua%' 
AND is_active = true;