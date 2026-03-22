# Inclawbator — Complete Capabilities Map

> The Inclawbator is 4 things: a **Builder**, a **Manager**, a **Studio**, and a **Brain**.
> Everything it can do falls into one of these categories.

---

## 1. BUILDER — Create stuff

Help users launch tokens, deploy infrastructure, build apps, and create assets.

| # | Capability | Status | How it works | Chat example |
|---|-----------|--------|-------------|-------------|
| 1 | **Launch a Token** | LIVE | Deploys on Base via Clanker with auto LP. User provides name, symbol, wallet. | "Launch a token called MoonCat, symbol MCAT" |
| 2 | **Deploy Staking Pool** | LIVE | Creates a staking contract for any token. Stakers earn CLAWS rewards. | "Deploy staking for 0x7ca4..." |
| 3 | **Build an App** | LIVE | Generates a full web app with Llama 3.3 70B, publishes live at inclawbate.app/s/[slug]. | "Build me a portfolio tracker app" |
| 4 | **Airdrop Tokens** | LIVE | Distribute tokens to multiple wallets in one transaction. | "Airdrop 1000 CLAWS to these 5 wallets" |
| 5 | **Generate Logo / Art** | COMPUTE | Image gen via FLUX/SDXL on community GPUs. | "Create a logo for my token called SolarCat" |
| 6 | **Generate Marketing Images** | COMPUTE | Banners, social cards, memes for promotion. | "Make me a Twitter banner for my project" |
| 7 | **Generate Promo Video** | COMPUTE | Short video clips from text/image via Stable Video Diffusion. | "Create a 5-second promo clip for my token launch" |
| 8 | **Create Landing Page** | LIVE (via build_app) | Full HTML landing page, published live. | "Build a landing page for my DeFi project" |
| 9 | **Translate Content** | COMPUTE | Translate app content, descriptions, marketing copy to 200+ languages via NLLB. | "Translate my token description to Spanish and Japanese" |

---

## 2. MANAGER — Run stuff

Help users monitor, analyze, promote, and manage their projects.

| # | Capability | Status | How it works | Chat example |
|---|-----------|--------|-------------|-------------|
| 10 | **Token Analytics** | LIVE | Live price, volume, liquidity, 24h change from DexScreener. | "What's the price of 0x7ca4...?" |
| 11 | **Staking Stats** | LIVE | TVL, APY, staker count, reward rates. Can check specific wallet positions. | "Show me CLAWS staking stats" |
| 12 | **Health Check** | LIVE | Full project diagnostics — price, volume, staking, agent status. Gives actionable suggestions. | "Run a health check on my project" |
| 13 | **Book Promotion** | LIVE | Book a shoutout, campaign, or featured slot on @inclawbate X. Paid in CLAWS. | "I want to promote my project on Inclawbate's X" |
| 14 | **Fee Report** | LIVE (via health_check) | Check pending WETH from LP trading fees across all tokens. | "Check my pending fees for wallet 0x91B5..." |
| 15 | **Hire a Human** | LIVE | Posts a gig request to the Inclawbate Council Telegram. Council member responds within 24h. | "I need someone to design branding for my project" |
| 16 | **Create Marketing Agent** | LIVE | Instructions to set up an AI agent that auto-posts to X on a schedule. | "How do I create a marketing agent?" |
| 17 | **Auto-Generate Social Content** | COMPUTE | AI writes + designs social posts (text + image) ready to publish. | "Write me 5 tweets with images for my token launch" |

---

## 3. STUDIO — Creative tools (powered by compute network)

GPU-powered creative tools available to every user and every app. These are what the community compute network enables.

### Image

| # | Capability | Status | How it works | Chat example |
|---|-----------|--------|-------------|-------------|
| 18 | **Text-to-Image** | COMPUTE | Generate images from a text description. FLUX.1 / SDXL on community GPUs. | "Generate an image of a lobster astronaut in space" |
| 19 | **Image Upscaling** | COMPUTE | Enhance low-res images to high-res. Real-ESRGAN. | "Upscale this image to 4x resolution" |
| 20 | **Background Removal** | COMPUTE | Remove backgrounds from any image. SAM / REMBG. | "Remove the background from my logo" |
| 21 | **Image Editing** | COMPUTE | Edit images using text instructions. InstructPix2Pix / ControlNet. | "Make this image look more cyberpunk" |
| 22 | **Face Restoration** | COMPUTE | Fix/enhance faces in photos. GFPGAN. | "Fix the faces in this group photo" |
| 23 | **Style Transfer** | COMPUTE | Apply an art style to any image. | "Make this photo look like a watercolor painting" |
| 24 | **Image Captioning** | COMPUTE | Describe what's in an image. BLIP / LLaVA. | "What's in this image?" |

### Audio

| # | Capability | Status | How it works | Chat example |
|---|-----------|--------|-------------|-------------|
| 25 | **Speech-to-Text** | COMPUTE | Transcribe audio/video to text. Whisper. | "Transcribe this voice memo" |
| 26 | **Text-to-Speech** | COMPUTE | Generate natural-sounding voiceovers. Bark / Coqui XTTS. | "Read this paragraph out loud" |
| 27 | **Music Generation** | COMPUTE | Create music from a text description. MusicGen / AudioCraft. | "Generate a 30-second lo-fi beat for my app" |
| 28 | **Voice Cloning** | COMPUTE | Clone a voice from a sample. XTTS / RVC. | "Clone this voice and read my script" |

### Video

| # | Capability | Status | How it works | Chat example |
|---|-----------|--------|-------------|-------------|
| 29 | **Image-to-Video** | COMPUTE | Animate a still image. Stable Video Diffusion / AnimateDiff. | "Animate my logo spinning" |
| 30 | **Auto-Subtitles** | COMPUTE | Generate and burn subtitles into video. Whisper-based. | "Add subtitles to this video" |
| 31 | **Video Upscaling** | COMPUTE | Enhance video resolution. | "Upscale this clip to 1080p" |

### 3D

| # | Capability | Status | How it works | Chat example |
|---|-----------|--------|-------------|-------------|
| 32 | **Text-to-3D** | COMPUTE | Generate 3D models from text. Shap-E / Point-E. | "Generate a 3D model of a treasure chest" |

---

## 4. BRAIN — Know the ecosystem

Answer questions, recommend tools, search across apps, and help users navigate Inclawbate.

| # | Capability | Status | How it works | Chat example |
|---|-----------|--------|-------------|-------------|
| 33 | **Ecosystem Info** | LIVE | What is Inclawbate, key links, CLAWS token, capabilities overview. | "What is Inclawbate?" |
| 34 | **Incubation Info** | LIVE | Full-service incubation details — services, process, cost (free with fee split). | "Tell me about incubation" |
| 35 | **Browse Apps** | LIVE | Discover community-built apps in the ecosystem. | "Show me apps on Inclawbate" |
| 36 | **Semantic App Search** | COMPUTE | Search apps by meaning, not just keywords. Sentence transformer embeddings. | "Find me a game where I can bet tokens" |
| 37 | **Smart Recommendations** | COMPUTE | AI-powered suggestions based on what you're building. | "I'm building a social token — what tools should I use?" |
| 38 | **Document Understanding** | COMPUTE | Read and answer questions about uploaded docs/images. OCR + LLaVA. | "What does this whitepaper say about tokenomics?" |

---

## Status Key

| Status | Meaning |
|--------|---------|
| **LIVE** | Working right now in the Inclawbator chat |
| **COMPUTE** | Requires compute network (community GPUs). Coming when nodes are online. |

---

## Summary

| Category | Live | Coming with Compute | Total |
|----------|------|-------------------|-------|
| Builder | 4 | 5 | 9 |
| Manager | 7 | 1 | 8 |
| Studio | 0 | 15 | 15 |
| Brain | 3 | 3 | 6 |
| **Total** | **14** | **24** | **38** |

---

## How it shows up in the chat UI

The Inclawbator chat should surface these 4 categories clearly:

```
┌─────────────────────────────────────────────────┐
│  What do you want to do?                        │
│                                                 │
│  🔨 BUILD    Launch tokens, deploy apps,        │
│              create assets                      │
│                                                 │
│  📊 MANAGE   Analytics, health checks,          │
│              promotion, hiring                  │
│                                                 │
│  🎨 STUDIO   Image gen, audio, video,           │
│              creative tools                     │
│                                                 │
│  🧠 BRAIN    Questions, search, recommendations │
│                                                 │
│  Or just ask me anything...                     │
└─────────────────────────────────────────────────┘
```

Each category expands into quick-action chips for the top capabilities.

---

## API Endpoints (current + planned)

### Live (agent-chat)
All live capabilities route through: `POST /api/inclawbate/agent-chat`

### Planned (compute network)
These will be standalone endpoints any Inclawbate app can call:

```
POST /api/inclawbate/ai/image         → Text-to-image (FLUX/SDXL)
POST /api/inclawbate/ai/upscale       → Image upscaling
POST /api/inclawbate/ai/remove-bg     → Background removal
POST /api/inclawbate/ai/edit-image    → Text-based image editing
POST /api/inclawbate/ai/caption       → Image captioning
POST /api/inclawbate/ai/chat          → Text generation (Llama/Mistral)
POST /api/inclawbate/ai/transcribe    → Speech-to-text (Whisper)
POST /api/inclawbate/ai/tts           → Text-to-speech
POST /api/inclawbate/ai/music         → Music generation
POST /api/inclawbate/ai/video         → Image/text to video
POST /api/inclawbate/ai/subtitles     → Auto-subtitle video
POST /api/inclawbate/ai/translate     → Text translation (200+ langs)
POST /api/inclawbate/ai/3d            → Text-to-3D model
POST /api/inclawbate/ai/search        → Semantic search
```

No API key required. Any Inclawbate app calls these for free. Community GPUs handle the work.

---

## What already exists vs what compute adds

### Already working (free, no GPUs needed)
Text generation is already free via Groq / Cerebras / Bankr:
- Agent chat (Llama 3.1 8B / Llama 3.3 70B / DeepSeek / Qwen)
- App builder at `/build` (Llama 3.3 70B via Groq)
- All Builder + Manager + Brain capabilities already work

### What the compute network actually unlocks (NEW)
Everything in the **Studio category** — these require real GPU power and can't be done with free text APIs:
- Image generation, upscaling, editing, background removal, style transfer
- Audio transcription, text-to-speech, music generation, voice cloning
- Video generation, auto-subtitles, video upscaling
- 3D model generation
- Translation at scale (200+ languages)

**The compute network is about the Studio.** Text/chat is already solved.

## Implementation Priority

### Phase 1 — Studio endpoints via paid proxies
Build the Studio API endpoints, proxy to Replicate / Together.ai for GPU tasks. Get the interface working.
- `/ai/image` → proxy to Replicate (FLUX)
- `/ai/transcribe` → proxy to Replicate (Whisper) or Groq
- `/ai/tts` → proxy to Replicate (Bark)
- `/ai/remove-bg` → proxy to Replicate (REMBG)

### Phase 2 — Compute network MVP
Build Docker node image + job router. Switch Studio backends from paid proxies to community GPUs. Node operators earn CLAWS.
- `/ai/image` → route to community GPU running FLUX
- `/ai/transcribe` → route to community GPU running Whisper
- Add remaining Studio endpoints as models are supported

### Phase 3 — Full Studio
All 15 Studio endpoints live on community GPUs. Studio section in Inclawbator chat UI fully functional.

### Phase 4 — Custom models
Fine-tune models on ecosystem data. Inclawbator runs on its own model. Full independence from paid APIs.
