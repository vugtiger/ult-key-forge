# Host-independent script delivery

## Goal
Make copied and generated loadstrings use the website address currently serving the app, with no Netlify dependency or hardcoded hosting provider.

## Changes
- Remove all Netlify-specific assumptions and direct backend fallbacks from user-facing loader generation.
- Use the current website origin for Pastebin, dashboard, editor, and loader-page links.
- Make backend-generated follow-up requests preserve the trusted public host supplied by the website proxy.
- Keep Discord-created links configurable through the active public website setting, without a Netlify default.
- Correct malformed follow-up loader URLs that currently duplicate the script slug in query parameters.
- Retain generic forwarding configurations for supported hosts; these are hosting adapters, not a dependency on one provider.
- Verify no Netlify URL remains, checks pass, and generated Lua uses one consistent host and valid request URLs.

## Technical details
Each deployed host must forward `/s/:slug` to the delivery function while preserving the original host. The browser will generate `/s/<slug>` on its own origin. The delivery function will validate forwarded host values before embedding that same origin into subsequent Lua requests; direct backend requests remain supported internally but never become copied loadstrings.
