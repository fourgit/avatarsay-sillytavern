# AvatarSay RPG NPC & Voice Bark — SillyTavern Extension

Roll deterministic tabletop RPG & D&D NPC Character Cards (**Spec V2**) for **0 credits with no API key**, import them directly into **SillyTavern** in one click (no JSON copy-pasting), play **instant `<3s` MP3 character voice barks**, and generate **1024px character portraits** via the [AvatarSay Remote MCP Server](https://avatarsay.com/mcp).

## One-Click Installation in SillyTavern

1. Open SillyTavern and click the **Extensions** icon (stacked blocks) in the top bar.
2. Click **Install extension** and paste the repository URL below:

```text
https://github.com/fourgit/avatarsay-sillytavern
```

3. Click **Install for all users** (or **Install just for me**).
4. Expand **AvatarSay RPG NPC & Voice Bark** inside the Extensions panel to start rolling and importing NPCs!

---

## Features

- **Zero-Key, 0-Credit NPC Roller (`roll_rpg_npc`):**
  Roll complete tabletop NPCs with optional deterministic `seed`, art `style`, `gender`, `ancestry`, and `role` — including appearance, personality traits, table habit/quirk, plot hook, GM secret, first message, example dialogue, and built-in voice sample preview.
- **One-Click SillyTavern Character Import (`/api/characters/import`):**
  Submits the spec-compliant `chara_card_v2` JSON directly into SillyTavern's character library and refreshes your Characters list automatically (with a 1-click `.json` download button alongside it).
- **Instant `<3s` MP3 Character Voice Barks (`create_npc_voice_line`):**
  With an optional `avs_...` API key, synthesize spoken character lines in under 3 seconds (`2 credits / 100 chars`) across 8 English voices and 6 vocal emotions, playable inline or downloadable as `.mp3`.
- **2×1024px Character Portraits (`generate_avatars` -> `get_job`):**
  Generate `1024×1024` portraits in 8 art styles (`fantasy`, `anime`, `3d-cartoon`, `pixel-art`, `watercolor`, `cyberpunk`, `realistic`, `professional-headshot`) and apply directly to your active SillyTavern character or download as PNG.

## Optional API Key & Free Credits

Rolling and importing `chara_card_v2` NPCs requires **no account and 0 credits**.
To unlock `<3s` MP3 voice barks and `1024px` portrait generation:

1. Sign in at [AvatarSay Studio](https://avatarsay.com/dashboard) — new accounts receive **30 free credits** (up to 15 NPC voice barks or 14 character portraits, plus 1 free `<=5s` talking MP4 clip).
2. Create an `avs_...` API key in `/dashboard` and paste it into the **API Key** field in the AvatarSay extension panel.

## Links

- **Web NPC Generator:** [https://avatarsay.com/fantasy-npc-generator](https://avatarsay.com/fantasy-npc-generator)
- **AvatarSay Remote MCP Server (`2025-06-18`):** [https://avatarsay.com/mcp](https://avatarsay.com/mcp)
- **License:** [MIT](./LICENSE)
