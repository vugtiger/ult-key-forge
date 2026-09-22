# Fix anti-fetch trap delivery

## Changes
- Replace permanent-ban Lua responses with harmless decoy source that contains the tracked source link but no visible `Kick` or ban wording.
- Handle trap URLs before the existing-ban shortcut so visiting a trap always records the trap event and opens the blocked page.
- Add a website fallback for `/s/trap_<token>` so hosts that serve the app instead of forwarding `/s/*` still send the visitor through the real trap endpoint.
- Keep normal executor failures, key errors, and rate-limit messages unchanged.

## Verification
- Deploy the delivery function.
- Test a fresh trap URL as a browser and as a fetcher.
- Confirm browsers reach the blocked page and fetched files contain no explicit ban or kick text.
