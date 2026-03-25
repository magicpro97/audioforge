# 🔊 AudioForge — AI Audio Generator CLI

[![npm version](https://img.shields.io/npm/v/audioforge)](https://www.npmjs.com/package/audioforge)
[![CI](https://github.com/magicpro97/audioforge/actions/workflows/ci.yml/badge.svg)](https://github.com/magicpro97/audioforge/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Multi-provider AI sound effect & music generation from your terminal.

- **4 Providers**: ElevenLabs, Stability AI, fal.ai, Replicate
- **Sound Effects**: Game sounds, UI clicks, foley, ambient noise
- **Music Generation**: Background music, loops, tracks with genre/BPM control
- **15 Style Presets**: game-sfx, cinematic, 8-bit, ambient, electronic, orchestral...
- **Batch Processing**: Generate multiple audio files from YAML config
- **Templates**: Save prompts with `{variables}` for repeatable generation
- **Cost Tracking**: Per-provider spending summaries
- **History**: Full generation log with search

## Quick Start

```bash
npm install -g audioforge

# Configure a provider
audioforge config set elevenlabs.apiKey sk-your-key

# Generate a sound effect
audioforge gen "laser beam shooting"

# Generate with a style preset
audioforge gen "footsteps on gravel" --preset game-sfx

# Generate music
audioforge music "lo-fi hip hop beat" --genre ambient --duration 30

# Compare providers
audioforge compare "thunder rumble"
```

## Commands

### Sound Effects

```bash
audioforge generate <prompt>         # (alias: gen, g)
  -p, --provider <name>              # elevenlabs, stability, fal, replicate
  -m, --model <model>                # Specific model
  -d, --duration <seconds>           # Duration or preset (blip, short, medium...)
  -o, --output <path>                # Output file path
  -f, --format <type>                # wav, mp3, ogg, flac (default: wav)
  -s, --preset <style>               # Style preset (game-sfx, cinematic, 8-bit...)
  -t, --template <name>              # Use saved prompt template
  -v, --var <key=value>              # Template variable (repeatable)
  --seed <number>                    # Seed for reproducibility
  --loop                             # Generate seamless loop
  --open                             # Open audio after generation
```

### Music

```bash
audioforge music <prompt>            # (alias: m)
  -p, --provider <name>              # stability, fal, replicate
  -d, --duration <seconds>           # Duration (default: 30)
  --genre <genre>                    # ambient, electronic, orchestral, rock...
  --bpm <bpm>                        # Tempo in BPM
  --instrumental                     # Instrumental only, no vocals
  --loop                             # Seamless loop
```

### Other Commands

```bash
audioforge compare <prompt>          # Compare across providers
audioforge batch <file.yaml>         # Batch generate from YAML/JSON
audioforge convert <input> --to mp3  # Convert audio format
audioforge providers list            # List all providers
audioforge history list              # View generation history
audioforge template save <n> <p>     # Save prompt template
audioforge cost summary              # Spending summary
audioforge cost pricing              # Per-provider pricing
audioforge config set <key> <val>    # Set configuration
audioforge config list               # Show all config
```

## Providers

| Provider | Models | Capabilities | API Key |
|----------|--------|--------------|---------|
| **ElevenLabs** | eleven_sfx_v2 | SFX, Loop | `elevenlabs.apiKey` |
| **Stability AI** | stable-audio-2.5 | SFX, Music (up to 3 min) | `stability.apiKey` |
| **fal.ai** | CassetteAI, Beatoven | SFX, Music | `fal.apiKey` |
| **Replicate** | MusicGen, AudioGen | SFX, Music, Variations | `replicate.apiKey` |

### Setup

```bash
audioforge config set elevenlabs.apiKey "your-elevenlabs-key"
audioforge config set stability.apiKey "your-stability-key"
audioforge config set fal.apiKey "your-fal-key"
audioforge config set replicate.apiKey "your-replicate-key"
```

## Style Presets

| Preset | Description |
|--------|-------------|
| `game-sfx` | Punchy, clear, game-ready sound effect |
| `ui-click` | Subtle, satisfying UI interaction sound |
| `ambient` | Atmospheric environmental ambience |
| `cinematic` | Dramatic, theatrical sound design |
| `foley` | Realistic everyday sound recording |
| `8-bit` | Retro chiptune pixel game sound |
| `sci-fi` | Futuristic, technological sound |
| `fantasy` | Magical, ethereal, enchanting sound |
| `horror` | Dark, unsettling, eerie atmosphere |
| `electronic` | Synthesized, modern electronic sound |
| `orchestral` | Classical orchestral instruments |
| `lo-fi` | Warm, vintage, relaxing lo-fi sound |
| `notification` | Short, attention-grabbing alert |
| `transition` | Smooth whoosh/sweep transition |
| `nature` | Natural environmental outdoor sound |

## Duration Presets

| Preset | Duration |
|--------|----------|
| `blip` | 0.5s |
| `short` | 2s |
| `medium` | 5s |
| `long` | 10s |
| `extended` | 30s |
| `music-short` | 15s |
| `music-medium` | 30s |
| `music-long` | 60s |
| `music-full` | 180s |

## Batch Processing

Create a YAML file:

```yaml
items:
  - prompt: "laser beam"
    type: sfx
    provider: elevenlabs
    duration: 3
  - prompt: "ambient piano loop"
    type: music
    provider: stability
    duration: 30
```

```bash
audioforge batch sounds.yaml
audioforge batch sounds.yaml --dry-run  # Preview only
```

## Templates

```bash
# Save a template with variables
audioforge template save game-hit "{material} impact on {surface}" --preset game-sfx

# Use the template
audioforge gen "" -t game-hit -v material=metal -v surface=concrete

# List and manage
audioforge template list
audioforge template show game-hit
audioforge template delete game-hit
```

## Part of the Forge Ecosystem

| Tool | Purpose |
|------|---------|
| [AppForge](https://github.com/magicpro97/appforge) | Scaffold projects |
| [BackForge](https://github.com/magicpro97/backforge) | Backend init |
| [TestForge](https://github.com/magicpro97/testforge) | AI test generation |
| [ImgForge](https://github.com/magicpro97/imgforge) | AI image generation |
| **AudioForge** | **AI audio generation** |
| [ScreenForge](https://github.com/magicpro97/screenforge) | App store assets |
| [StoreForge](https://github.com/magicpro97/storeforge) | Store deployment |
| [MonForge](https://github.com/magicpro97/monforge) | Production monitoring |

## License

MIT © [magicpro97](https://github.com/magicpro97)
