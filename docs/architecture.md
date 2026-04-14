# RhymeNexus — Branch & Deployment Architecture

## Two-Branch, Two-App Model

This repo contains **two distinct applications** on separate branches. They share most JS modules but have different `index.html` and `styles.css` roots.

| | `main` branch | `discord` branch |
|---|---|---|
| **App** | Full RhymeNexus | Discord Activity |
| **URL** | rhymenex.us | discord.rhymenex.us |
| **Vercel project** | `base-flow-arena` | `rhymenexus-discord` |
| **Local dev** | `python server.py` (port 8000) ✅ default | `python server.py` on discord branch |
| **Layout** | Full — voice, live feed, BPM detect, mic search, key finder | Stripped — no mic-dependent features, compact `discord-activity` body class |
| **Multiplayer** | No | Yes — PartyKit + Discord SDK |

## Why Two Branches

The Discord Activity runs inside a small Discord iframe. Features that require a microphone (voice match, BPM detect, live feed) don't make sense there — the user is already talking in a Discord voice channel. The stripped-down build keeps the Activity focused.

## Merge Direction

**One-way only: `main` → `discord`.**  
When features ship on `main`, cherry-pick or merge them into `discord` if they apply to the Activity. Never merge `discord` back into `main` — the Discord-specific layout changes (removed elements, PartyKit code, Discord SDK init) must not bleed into the main app.

## API Calls

Both branches use **relative URLs** for external APIs (`/datamuse/...`, `/dictapi/...`). These are handled differently per environment:

| Environment | How `/datamuse/...` resolves |
|---|---|
| **Vercel (production)** | `vercel.json` rewrites proxy to `api.datamuse.com` |
| **Discord Activity (in Discord)** | Discord's root mapping routes through `discord.rhymenex.us` → Vercel → rewrite |
| **localhost** | `server.py` proxy routes forward to `api.datamuse.com` |

If you add a new external API, you must update **three places**: `vercel.json` rewrites, `server.py` `API_PROXIES`, and (for Discord) `patchUrlMappings` in `public/js/main.js`.

## Local Development

**Default workflow — always start here:**

```bash
git checkout main
python server.py        # http://localhost:8000 — full app
```

`main` is where the product lives. Port 8000 on `main` is the primary dev environment. This is the right place to build new features, fix bugs, and test the full app.

**Discord Activity workflow — only when working on discord-specific things:**

```bash
git checkout discord
python server.py        # http://localhost:8000 — Discord Activity build
```

Switch to the `discord` branch only when you're specifically working on Discord Activity features (PartyKit sync, layout changes for the iframe, Discord SDK). Switch back to `main` when done.

The local server proxies `/datamuse/` and `/dictapi/` to the real APIs automatically on both branches. No Vercel CLI or tunnel needed for basic feature work.

## Deploying the Discord Activity

Pushes to the `discord` branch deploy automatically to the `base-flow-arena` Vercel project as a **preview** deployment. The `rhymenexus-discord` project (which serves `discord.rhymenex.us`) must be deployed separately — currently done manually.

**TODO:** Wire `rhymenexus-discord` to auto-deploy from the `discord` branch on GitHub so pushes reach `discord.rhymenex.us` automatically.
