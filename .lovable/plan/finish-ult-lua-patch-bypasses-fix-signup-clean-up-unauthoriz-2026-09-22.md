# Finish ULT LUA: patch bypasses, fix signup, clean up unauthorized page, redesign owner panel

This is a big list. I've grouped it so you can approve or trim before I burn credits.

## 1. Patch the bypasses you sent (loader-side, all pastes, always on)

The three attacks share one weakness: they hook `loadstring` / `loadfile` / `writefile` / `hookfunction` *before* our payload runs, then either dump the source string or swap it for a dummy.

Loader hardening (added to the Lua the backend returns, before any real payload):

- Snapshot `loadstring`, `loadfile`, `writefile`, `appendfile`, `hookfunction`, `hookmetamethod`, `newcclosure`, `getgc`, `getupvalue(s)`, `debug.getinfo`, `HttpGet`, `HttpService.RequestAsync` at load time and use only the snapshots inside the loader.
- Refuse to run if `hookfunction`/`hookmetamethod` exist and any of the snapshotted globals fail an identity check (`rawequal` on cached vs current), or if `debug.gethook()` returns non-nil, or if `checkcaller()` is false when it should be true. On failure: no execution, silent report to backend, add attacker to bans.
- Never pass the real payload string to `loadstring` directly. Compile it inside a `newcclosure`-wrapped local using the snapshotted `loadstring`, so the hooked global never sees it. Also split the payload into N chunks XORed with a per-request key and only concatenate inside that closure — the hook only ever sees garbage.
- Wrap the compiled chunk with `setfenv` into a sealed env so `getfenv`/`getgc` walks don't find the source string. Overwrite the source variable with `nil` immediately after compile.
- Ban trigger: any of the above tamper checks → POST to `report-bypass` with HWID+IP+account → permanent ban (profile + ip + subnet + hwid). Same trigger anyone visiting an `/s/<slug>` URL from a normal browser (not Roblox UA).

Second attack surface — the "anti-tamper 0.1s loop" they wrote: harmless to us as long as our loader never touches globals after boot. Confirmed by the design above; nothing extra needed.

## 2. Fake-source trap for `writefile`/`readfile` dumpers (always on, every paste)

When the loader boots it writes a decoy file `ULT_MAIN_SOURCE.lua` (and a few plausible names like `loader.lua`, `keysystem.lua`) into workspace via the snapshotted `writefile`. Contents:

```
-- ULT LUA MAIN SOURCE CODE
-- Full source mirror: https://ultluacodeprotectsyourcode.lovable.app/s/__trap__<random>
```

The `/s/__trap__*` route on the backend behaves exactly like the current unauthorized-access branch: bans profile + ip + subnet + hwid, returns the branded page for browsers. Not a toggle — baked into every generated loader.

## 3. Unauthorized page: stop serving raw HTML from the backend URL

Right now `iyfvpnjrghsownkpazec.supabase.co/functions/v1/get-paste/s/...` returns a raw HTML string, which is why browsers show source. Fix:

- Backend detects browser UA on that route and instead returns HTTP 302 → `https://ultluacodeprotectsyourcode.lovable.app/blocked?ref=<slug>` (or whichever origin the request came through). No HTML body from backend.
- `/blocked` on the site is a real branded page (CloudBackground, ULT logo, "You accessed an unauthorized delivery route. Your device has been banned."). Same ban side-effects as before.
- Executor UA on the backend URL still gets real Lua — nothing changes for legitimate execution.

## 4. Ban enforcement actually blocks you

You reported you got "banned" but could still sign up and execute. Fix:

- Signup: check `banned_hwids`, `banned_ips`, `banned_subnets`, `banned_profiles` in the signup edge function before creating the auth user. If any hit → 403 "This device is permanently banned."
- Loader execution: `get-paste` already checks bans; audit the code path and make sure the checks run *before* the payload is returned, and that HWID + IP + subnet are all consulted (not just profile).
- Add an admin "Unban me" button in the owner panel so you can test without staying locked out.

## 5. Signup flow

- Check for existing email in `auth.users` first; if it exists, return "An account with this email already exists." — not "account created".
- Turn on email confirmation for new signups; success message becomes "We sent a verification email — please confirm before logging in."
- Login: if `email_confirmed_at` is null, block with "Email not verified — check your inbox."

## 6. Owner panel redesign

- New two-column layout: left rail (nav), right content. No more everything-in-one-scroll.
- Sections: Overview, Pastes, Keys, Bans, Discord Bot, Users, Security Log, Settings.
- Cards use consistent spacing (16px), max-width containers, no overflow. Buttons never wrap text outside their box.
- Same purple-cloud theme, no emojis.

## 7. Site-wide overflow pass

Sweep every page/component: `truncate` on button text, `min-w-0` on flex children, `max-w-full` on cards, `overflow-x: hidden` verified on root. Nothing escapes the viewport on 375px width.

## Out of scope for this pass

- Anything not in the message above (no new features, no new pages beyond `/blocked`).
- The two "authenticated_security_definer_function_executable" warnings — you told me to leave those.

## Questions before I start

I'll ask 2 quick things right after you approve, so I don't guess wrong on scope.

## Technical notes

- Loader: edit `supabase/functions/get-paste/index.ts` (payload wrapper + trap files + browser-UA redirect).
- Signup: edit signup edge function + `configure_auth` (require email confirm). If you don't have a custom signup function, guard the client-side signup path.
- Bans: shared helper `assertNotBanned(supabase, { userId, ip, hwid })` reused by signup + get-paste + discord-bot.
- Owner panel: `src/pages/OwnerDashboard.tsx` (or wherever the current owner panel lives — I'll locate it) + shared `<PanelShell>` component.
- Overflow pass: grep for known offenders (`whitespace-nowrap` without `truncate`, buttons with long labels).
