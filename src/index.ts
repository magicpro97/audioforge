#!/usr/bin/env node
import { Command } from 'commander';
import { generateCommand } from './cli/commands/generate.js';
import { musicCommand } from './cli/commands/music.js';
import { configCommand } from './cli/commands/config.js';
import { providersCommand } from './cli/commands/providers.js';
import { historyCommand } from './cli/commands/history.js';
import { templateCommand } from './cli/commands/template.js';
import { costCommand } from './cli/commands/cost.js';
import { compareCommand } from './cli/commands/compare.js';
import { batchCommand } from './cli/commands/batch.js';
import { convertCommand } from './cli/commands/convert.js';
import { getPresetNames } from './core/presets.js';
import { getDurationPresetNames } from './core/durations.js';

const program = new Command();

program
  .name('audioforge')
  .description('🔊 AudioForge - AI Audio Generator CLI\n\n  Multi-provider AI sound effect & music generation from your terminal.\n  Supports ElevenLabs, Stability AI (Stable Audio), fal.ai, and Replicate (MusicGen).')
  .version('1.0.0');

// Generate SFX
program
  .command('generate <prompt>')
  .alias('gen')
  .alias('g')
  .description('Generate sound effect(s) from a text prompt')
  .option('-p, --provider <name>', 'AI provider (elevenlabs, stability, fal, replicate)')
  .option('-m, --model <model>', 'Specific model to use')
  .option('-d, --duration <seconds>', `Duration in seconds or preset (${getDurationPresetNames().slice(0, 4).join(', ')}...)`)
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <type>', 'Output format (wav, mp3, ogg, flac)')
  .option('-s, --preset <style>', `Style preset (${getPresetNames().slice(0, 5).join(', ')}...)`)
  .option('-t, --template <name>', 'Use a saved prompt template')
  .option('-v, --var <key=value...>', 'Template variable (repeatable)', (v: string, prev: string[]) => [...prev, v], [])
  .option('--seed <number>', 'Seed for reproducibility')
  .option('--loop', 'Generate seamless loop')
  .option('--open', 'Open audio after generation')
  .option('--platform <name>', 'Target platform (ios, android, web, game) - auto-sets format')
  .action(generateCommand);

// Generate Music
program
  .command('music <prompt>')
  .alias('m')
  .description('Generate music from a text prompt')
  .option('-p, --provider <name>', 'AI provider (stability, fal, replicate)')
  .option('-m, --model <model>', 'Specific model to use')
  .option('-d, --duration <seconds>', 'Duration in seconds', '30')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <type>', 'Output format (wav, mp3, ogg, flac)', 'wav')
  .option('--genre <genre>', 'Music genre (ambient, electronic, orchestral, rock...)')
  .option('--bpm <bpm>', 'Tempo in BPM')
  .option('--instrumental', 'Instrumental only, no vocals')
  .option('--loop', 'Generate seamless loop')
  .option('--seed <number>', 'Seed for reproducibility')
  .option('--open', 'Open audio after generation')
  .action(musicCommand);

// Compare
program
  .command('compare <prompt>')
  .description('Compare same prompt across multiple providers')
  .option('-p, --providers <list>', 'Comma-separated provider list')
  .option('-d, --duration <seconds>', 'Duration in seconds', '5')
  .option('-o, --output <dir>', 'Output directory')
  .action(compareCommand);

// Batch
program
  .command('batch <file>')
  .description('Generate multiple audio files from a YAML/JSON config')
  .option('--dry-run', 'Preview without generating')
  .action(batchCommand);

// Convert
program
  .command('convert <input>')
  .description('Convert audio format (wav, mp3, ogg, flac)')
  .option('--to <format>', 'Target format', 'wav')
  .option('-o, --output <path>', 'Output file path')
  .action(convertCommand);

// Sub-commands
program.addCommand(configCommand);
program.addCommand(providersCommand);
program.addCommand(historyCommand);
program.addCommand(templateCommand);
program.addCommand(costCommand);

// Show help by default if no arguments
if (process.argv.length <= 2) {
  program.outputHelp();
  console.log('');
  console.log('  Quick start:');
  console.log('    $ audioforge generate "laser beam shooting"');
  console.log('    $ audioforge gen "footsteps on gravel" --preset game-sfx');
  console.log('    $ audioforge music "lo-fi hip hop beat" --genre ambient --duration 30');
  console.log('    $ audioforge batch sounds.yaml');
  console.log('    $ audioforge providers list');
  console.log('');
} else {
  program.parse();
}
