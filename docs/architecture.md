# RhymeNexus — Branch & Deployment Architecture

## Two-Branch, Two-App Model

This repo contains **two distinct applications** on separate branches. They share most JS modules but have different `index.html` roots and some CSS.

| | `main` branch | `discord` branch |
|---|---|---|
| **App** | Full RhymeNexus | Discord Activity |
| **Public URL** | rhymenex.us | discord.rhymenex.us |
| **Vercel project** | `base-flow-arena` (prj_6C21nZxhwiMZO41hBa0BUL9Tl4eT) | `rhymenexus-discord` (prj_wHRPblGTvTozCvcwOTThPzlSwpyS) |
| **Local dev** | `python server.py` → port 8000 (default) | `python server.py` on discord branch → port 8000 |
| **Layout** | Full — voice, live feed, BPM detect, mic search, key finder | Stripped — no mic features, compact `body.discord-activity` layout |
| **Multiplayer** | No | Yes — PartyKit + Discord SDK |
| **Vercel team** | Chris R's projects (team_FLeB6fr1dFji5a2iZLqbwTJO) | Same team |

## Why Two Branches

The Discord Activity runs inside a small Discord iframe (~1600×800). Features that require a microphone (voice match, BPM detect, live feed) don't make sense there — the user is already talking in a Discord voice channel. The stripped-down build keeps the Activity focused.

## Merge / Change Protocol

**One-way only: `main` → `discord`.** Never merge `discord` back into `main`.

### Changes that belong on `main` only
- Features requiring mic/speech (voice match, BPM detect, key finder, live feed)
- Full-width/desktop-only layout
- Anything using Web Speech API

### Changes that belong on `discord` only
- `public/js/session.js` (PartyKit multiplayer)
- Discord SDK initialization in `main.js`
- `patchUrlMappings` calls
- `body.discord-activity` compact CSS rules
- `.github/workflows/deploy-discord.yml` (this file must NOT exist on main)
- Removed UI elements specific to the Activity build

### Changes shared by both (most work)
- Word data, rhyme scoring, tooltip improvements
- Most UI polish, styling of shared components
- API proxy configuration (see API section below)
- Word lists, dictionaries

### How to apply a shared change to both
1. Develop + commit on `main` first (or `discord` if that's where you're testing)
2. Use an agent to surgically apply the same edits to the other branch — **do not cherry-pick or merge full commits**, because divergent files (`index.html`, `main.js`, `styles.css`, `vercel.json`) have branch-specific content that would get overwritten
3. Each file change must be reviewed to keep branch-specific code intact

## API Proxying

Both branches use **relative URLs** for external APIs (`/datamuse/...`, `/dictapi/...`). Three environments, three proxies:

| Environment | How `/datamuse/...` resolves |
|---|---|
| **Vercel production** | `vercel.json` rewrites proxy to `api.datamuse.com` |
| **Discord Activity (inside Discord)** | Discord's root URL mapping → `discord.rhymenex.us` → Vercel → rewrite |
| **localhost** | `server.py` `API_PROXIES` dict forwards to `api.datamuse.com` |

**Adding a new external API requires updating three places:**
1. `vercel.json` — add a rewrite block **before** the catch-all `/(.*) → /index.html`
2. `server.py` — add entry to `API_PROXIES` dict
3. Discord Developer Portal → URL Mappings (e.g. `/datamuse` → `api.datamuse.com`)

## Local Development

```bash
# Full app (default)
git checkout main
python server.py        # http://localhost:8000

# Discord Activity build
git checkout discord
python server.py        # http://localhost:8000
```

Port 8000 always. Branch determines what you see. The local server proxies APIs automatically — no Vercel CLI, tunnel, or Discord launch needed for most work. To actually test inside Discord, you need `npm run dev` (Cloudflared tunnel) — see Discord Activity section below.

## Deployment — How Each Branch Reaches Production

### `main` → `rhymenex.us` (simple)
- `base-flow-arena` Vercel project is connected to the GitHub repo
- Every push to `main` auto-deploys to `rhymenex.us`
- No manual steps

### `discord` → `discord.rhymenex.us` (GitHub Action + CLI)
- `rhymenexus-discord` Vercel project serves this domain but was created via CLI, not "Import from Git" → Vercel's UI has **no "Production Branch" setting** for this project
- Deploy is done via **GitHub Action** at `.github/workflows/deploy-discord.yml`:
  - Triggers on push to `discord` branch
  - Runs `npx vercel deploy --prod --yes --token $VERCEL_TOKEN`
  - Uses env vars `VERCEL_ORG_ID` (team_FLeB6fr1dFji5a2iZLqbwTJO) and `VERCEL_PROJECT_ID` (prj_wHRPblGTvTozCvcwOTThPzlSwpyS) to target the correct project
  - `VERCEL_TOKEN` is a GitHub repository secret (name: `VERCEL_TOKEN`)

### Critical: Ignored Build Step on `rhymenexus-discord`
Because `rhymenexus-discord` also has the GitHub repo connected (for PR comments and commit statuses), Vercel will by default try to deploy **every branch**, including `main` — overwriting the discord production deployment.

To prevent this, the project has an **Ignored Build Step** configured under Settings → Git (Behavior: Custom):

```
[ "$VERCEL_GIT_COMMIT_REF" != "discord" ]
```

Vercel's Ignored Build Step semantics are counterintuitive: **exit 1 = build proceeds**, **exit 0 = build skipped**. So the test must be `!=` — when the branch is `discord`, the test fails (exit 1) and the build proceeds; for `main` or anything else, the test succeeds (exit 0) and the build is skipped. Using `=` silently inverts it and lets `main` overwrite `discord.rhymenex.us`. The GitHub Action's `vercel deploy --prod` bypasses this check entirely.

**If you ever see `discord.rhymenex.us` running main-branch code**, check:
1. Ignored Build Step is still configured on `rhymenexus-discord` project
2. GitHub Action on the latest discord push succeeded (`gh run list --limit 5`)
3. Vercel deployments for `rhymenexus-discord` — the most recent `target: "production"` should be a `discord` branch commit

### Recovery: manually promote correct deployment
If the wrong commit ends up as production on `rhymenexus-discord`:

```bash
# Find the correct discord deployment ID via Vercel dashboard or MCP
# Temporarily point local .vercel/project.json at rhymenexus-discord
echo '{"projectId":"prj_wHRPblGTvTozCvcwOTThPzlSwpyS","orgId":"team_FLeB6fr1dFji5a2iZLqbwTJO"}' > .vercel/project.json

# Promote the correct deployment
vercel promote <deployment-id> --scope team_FLeB6fr1dFji5a2iZLqbwTJO --yes

# Restore project.json
# (keep a .vercel/project.json.bak of the base-flow-arena one)
```

## Discord Activity Configuration

### Discord Developer Portal
- App set up in Discord developer portal
- **URL Mappings** (required for all external calls from inside the Activity):
  - `/` → `discord.rhymenex.us` (root mapping)
  - `/datamuse` → `api.datamuse.com`
  - `/dictapi` → `api.dictionaryapi.dev`
  - `/partykit` → PartyKit host for multiplayer
- Adding a new external API here is the 3rd of the 3 places to update (see API Proxying)

### Runtime initialization
- `public/js/main.js` detects Activity context via `window.location.hostname === 'discord.com'` or `frame_id` URL param
- If in Activity: sets `body.discord-activity` class, imports/initializes Discord SDK, calls `patchUrlMappings` to rewrite absolute URLs, connects PartyKit session
- If not in Activity (e.g. direct visit to `discord.rhymenex.us`): runs as standalone web app without SDK

### Multiplayer (PartyKit)
- `public/js/session.js` — handles connect/broadcast/receive
- PartyKit server hosted separately (see PartyKit project)
- Activated only inside Discord Activity context

## Cache-Busting Strategy

**The trap:** Adding `?v=N` to individual ES module imports (`import './ui.js?v=14'`) **creates a separate module instance** per unique URL. If `main.js` imports `./ui.js?v=14` and `wordManager.js` imports `./ui.js`, they get two different copies of the ui module with separate state — callbacks set on one are invisible to the other.

**Correct approach:**
- Cache-bust only the HTML-level entry points: `styles.css?v=N`, `main.js?v=N` in `index.html`
- ES module imports inside JS files must use plain relative paths (no `?v=`)
- For production cache busting without `?v=`, `vercel.json` headers set:
  ```json
  {
    "source": "/public/js/(.*)\\.js",
    "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
  }
  ```
  This forces the browser to revalidate JS files on every request, picking up fresh code after deploys.

## Quick Reference — When Things Break

| Symptom | Likely cause | Fix |
|---|---|---|
| Discord Activity shows stale code (HTML entry changed) | Vercel/Discord browser cache of `index.html` | Bump `main.js?v=N` and `styles.css?v=N` in `index.html` |
| Discord Activity shows stale code (JS module changed, entry already reloaded) | Discord Web caches ES modules under their original URL; bumping entry doesn't invalidate them | **DevTools on the Activity → Application → Storage → Clear site data → close/reopen Activity.** Do NOT add `?v=` to a single module import — see next row. |
| Callback/state from main.js invisible in other modules | Split module instances from `?v=` on imports | Remove `?v=` from ES module imports, keep only on HTML `<script>`/`<link>` |
| Discord Activity runs main-branch UI | `rhymenexus-discord` deployed main branch | Check Ignored Build Step command is `[ "$VERCEL_GIT_COMMIT_REF" != "discord" ]` (note `!=`, not `=` — Vercel exit 1 = build, exit 0 = skip); promote correct discord deployment |
| API 404 in Activity only | Missing Discord URL mapping for that API | Add mapping in Developer Portal |
| Tooltip def/syn doesn't fetch on localhost | `server.py` API_PROXIES dict missing route | Add to dict, restart server |
