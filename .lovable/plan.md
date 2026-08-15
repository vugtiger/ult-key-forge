# Restore settings, keys, loader, and false bans

## What will change

1. **Correct the dashboard labels**
   - Rename the eye-icon `/script-settings` tab to **Settings / Keys**.
   - Rename the gear-icon `/settings` tab back to **Preferences**.
   - Rename the page headings to match those labels.

2. **Fix unreadable white text in Preferences**
   - Stop saved RGB values such as `255, 255, 255` from replacing the global foreground color on the light theme.
   - Clamp custom text colors to a readable lightness in both the initial theme loader and the Preferences page.
   - Keep the selected color visible only in its preview while the site’s functional text remains readable.

3. **Use the real ULT shield as the cursor**
   - Replace the current simple SVG cursor with a compact cursor version of the mint-and-peach shield logo shown in the screenshots.
   - Keep a precise hotspot and normal pointer behavior for interactive controls.

4. **Revert and repair the in-game key system**
   - Restore the previous v5 two-panel key GUI instead of the new wide v6 design.
   - Preserve responsive mobile scaling.
   - Fix the post-key payload handoff so a successful key always compiles and runs the returned protected loader, with a visible failure state instead of silently stopping.
   - Keep `_G.ScriptKey` protection-key loading functional and make URL encoding executor-safe.

5. **Remove false direct-link bans and prevent new ones**
   - Direct backend-link browser visits will be denied and logged, but will no longer auto-ban IPs, Roblox accounts, Discord accounts, devices, or linked networks.
   - Remove every active ban directly created by `unauthorized_backend_access` or browser report-link visits.
   - Also remove device/account/IP bans that were subsequently propagated from those false bans, while preserving unrelated manual and confirmed exploit bans.
   - Refresh/deploy the loader function so its in-memory ban cache no longer keeps removed bans active.

6. **AI availability**
   - Keep the existing Lovable AI integration working with the current Gemini model. AI model usage cannot be made unlimited/free by code alone.
   - A personal Gemini API key can be connected securely afterward if desired; it must be supplied through the secure secret form and may still be subject to Google’s quotas.

## Technical details

- Frontend: `DashboardLayout.tsx`, `Settings.tsx`, `ScriptSettings.tsx`, and `public/ult-cursor.svg`.
- Loader: `supabase/functions/get-paste/index.ts`; restore the v5 GUI from project history and retain the fixed payload flow.
- Data cleanup: targeted deletion from `global_bans` based on machine-readable rule metadata and linked false-ban identifiers; no legitimate manual bans are broadly cleared.
- Validation: run focused tests, inspect both settings routes at mobile/desktop sizes, test the loader function’s initial/key-success responses, and verify false-ban rows are gone.
