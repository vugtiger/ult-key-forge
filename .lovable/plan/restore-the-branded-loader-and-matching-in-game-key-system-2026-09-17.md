# Restore the branded loader and matching in-game key system

## What will change

1. **Make every displayed loadstring use the website address**
   - Generate `loadstring(game:HttpGet("<website>/s/<slug>"))()` everywhere on the site and in Discord.
   - Remove the visible backend-address fallback, including in preview.
   - Keep the backend function behind `/s/<slug>` so executors still receive Lua without exposing that address in copied loadstrings.

2. **Restore the loader page on branded links**
   - Detect a browser arriving through the hosted website proxy and return the branded loader page with the copy button.
   - Continue denying and logging direct browser visits to the raw backend function.
   - Do not create bans from direct-link browser visits, matching the existing false-ban prevention rule.

3. **Make the executed key system match the homepage design**
   - Replace the compact dark Roblox window with the ULT Loader v6.1 interface shown in the screenshot: header dots, ULT CLOUD branding, status badge, key entry, animated verification progress, Response/Payload/Console details, and console feedback.
   - Preserve the real key validation, ownership, expiry, URL encoding, protection-key, bypass-token, encrypted delivery, mobile scaling, draggable window, and compile-before-close behavior.
   - Show clear loading, success, invalid, expired, assigned, network, and compile-failure states.

4. **Fix the required security findings**
   - Preserve the existing profile moderation-column trigger and verify it covers self-unban attempts.
   - Prevent referral totals from being edited by users.
   - Prevent users from changing protected license-key fields while retaining safe note editing.

5. **Validate and deploy**
   - Check generated loadstrings contain only the hosted website address.
   - Test branded browser and executor-style `/s/<slug>` behavior separately.
   - Validate the website loader page at mobile and desktop widths.
   - Deploy the updated loader and Discord functions, then verify current errors and security findings.

## Technical details

- Frontend URL generation: `src/lib/loader-url.ts` and loader-page rendering.
- Hosting-aware browser/executor split: `supabase/functions/get-paste/index.ts` using the forwarded branded host.
- Discord output: `supabase/functions/discord-bot/index.ts` with a fixed branded-site fallback.
- In-game interface: rebuild `generateKeySystemGui()` without altering its server validation contract.
- Database protections: guarded update triggers for protected columns, applied through a migration.
