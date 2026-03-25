---
applyTo: "**/*.ts"
---

# AudioForge Development Instructions

This is the **AudioForge CLI** project — a multi-provider AI audio generation, sound effects, and music creation tool.

## Architecture

### Providers (`src/providers/`)
- `base.ts` — Abstract `AudioProvider` class with required `generate()` and optional `generateMusic()`, `vary()` methods
- `elevenlabs.ts` — ElevenLabs Sound Effects API (SFX generation, looping)
- `stability.ts` — Stability AI Stable Audio 2.5 (music + SFX, up to 3 min)
- `fal.ts` — fal.ai multi-model hub (CassetteAI, Beatoven)
- `replicate.ts` — Replicate (MusicGen, AudioGen from Meta AudioCraft)
- `index.ts` — Provider registry & factory

### Core (`src/core/`)
- `config.ts` — Config at `~/.audioforge/config.json`, with cost tracking and provider settings
- `history.ts` — Generation history log
- `output.ts` — Audio file saving and management
- `presets.ts` — 15 audio style presets (game-sfx, ambient, cinematic, 8-bit, etc.)
- `durations.ts` — Duration presets (short, medium, long, loop)
- `pricing.ts` — Per-provider/model cost estimation
- `templates.ts` — Template CRUD with `{variable}` rendering
- `opener.ts` — Cross-platform file opener

### CLI Commands (`src/cli/commands/`)
- `generate.ts` — Main SFX generation with --preset, --duration, --loop, --format
- `music.ts` — Background music generation with --genre, --bpm, --instrumental
- `batch.ts` — YAML/JSON-driven batch generation
- `compare.ts` — Multi-provider comparison
- `template.ts` — Template save/list/show/delete
- `cost.ts` — Cost tracking (summary/pricing/budget)
- `convert.ts` — Audio format conversion
- `history.ts` — History list + redo
- `config.ts` — Configuration management
- `providers.ts` — Provider listing

### Types (`src/types/`)
- `provider.ts` — AudioGenerationRequest, AudioGenerationResult, ProviderCapabilities
- `config.ts` — AppConfig, TemplateEntry, CostConfig

## Adding a New Provider

1. Create `src/providers/<name>.ts` extending `AudioProvider`
2. Implement required: `info`, `configure()`, `isConfigured()`, `validate()`, `generate()`, `listModels()`
3. Implement optional: `generateMusic()`, `vary()` as supported
4. Register in `src/providers/index.ts` providerRegistry Map
5. Add default config entry in `src/core/config.ts` DEFAULT_CONFIG
6. Add pricing in `src/core/pricing.ts`

## Adding a New Command

1. Create `src/cli/commands/<name>.ts` exporting a command function
2. Register in `src/index.ts`

## Conventions

- ESM modules (`"type": "module"` in package.json)
- All imports use `.js` extension (TypeScript ESM requirement)
- Dynamic imports for chalk/ora (ESM-only packages): `const chalk = (await import('chalk')).default`
- Node.js 20+ required
- No external HTTP dependencies — use built-in `fetch`
- Provider registry type: `Map<string, () => AudioProvider>`

## CI/CD

- GitHub CI builds on push (`.github/workflows/ci.yml`)
- npm publish is automatic via GitHub Release (`.github/workflows/publish.yml`)
- NPM_TOKEN stored as GitHub repo secret — never commit tokens
