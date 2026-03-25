import { createProvider } from '../../providers/index.js';
import { loadConfig, getProviderApiKey } from '../../core/config.js';
import { saveAudio } from '../../core/output.js';
import { addHistoryEntry } from '../../core/history.js';
import { estimateCost } from '../../core/pricing.js';
import { openFile } from '../../core/opener.js';
import type { AudioGenerationRequest } from '../../types/index.js';

interface MusicOptions {
  provider?: string;
  model?: string;
  duration?: string;
  output?: string;
  format?: string;
  seed?: string;
  instrumental?: boolean;
  genre?: string;
  bpm?: string;
  loop?: boolean;
  open?: boolean;
}

export async function musicCommand(prompt: string, options: MusicOptions): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  const config = loadConfig();
  const duration = parseInt(options.duration || '30') || 30;

  // Build enhanced prompt for music
  let enhancedPrompt = prompt;
  if (options.genre) enhancedPrompt = `${options.genre} style: ${enhancedPrompt}`;
  if (options.bpm) enhancedPrompt = `${enhancedPrompt}, ${options.bpm} BPM`;
  if (options.instrumental) enhancedPrompt = `${enhancedPrompt}, instrumental, no vocals`;
  if (options.loop) enhancedPrompt = `${enhancedPrompt}, seamless loop`;

  // Select music-capable provider
  const musicProviders = ['stability', 'fal', 'replicate'];
  /* v8 ignore start */
  const providerName = options.provider || musicProviders.find(p => {
    const key = getProviderApiKey(p);
    return key && key.length > 0;
  }) || 'stability';
  /* v8 ignore stop */

  const provider = createProvider(providerName);
  const apiKey = getProviderApiKey(providerName);
  if (apiKey) {
    provider.configure(apiKey);
  } else if (provider.info.requiresKey) {
    console.error(chalk.red(`\n  ✗ No API key configured for "${providerName}".`));
    console.error(chalk.yellow(`  → Run: audioforge config set ${providerName}.apiKey <your-key>`));
    console.error(chalk.dim(`  → Music generation requires: stability, fal, or replicate\n`));
    process.exit(1);
  }

  const request: AudioGenerationRequest = {
    prompt: enhancedPrompt,
    model: options.model,
    duration,
    format: (options.format as any) || config.defaults.format,
    loop: options.loop,
    seed: options.seed ? parseInt(options.seed) : undefined,
  };

  console.log('');
  console.log(chalk.bold('  🎵 AudioForge - AI Music Generator'));
  console.log(chalk.dim(`  Provider: ${provider.info.displayName}`));
  console.log(chalk.dim(`  Duration: ${duration}s`));
  if (options.genre) console.log(chalk.dim(`  Genre:    ${options.genre}`));
  if (options.bpm) console.log(chalk.dim(`  BPM:      ${options.bpm}`));
  console.log(chalk.dim(`  Prompt:   "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`));
  console.log('');

  const spinner = ora({ text: 'Generating music...', indent: 2 }).start();

  try {
    const result = await provider.generateMusic(request);
    spinner.succeed(`Generated music in ${(result.elapsed / 1000).toFixed(1)}s`);

    const cost = estimateCost(providerName, request.model || '', { duration });
    result.cost = cost;

    const saveResult = saveAudio(result, options.output, options.format || config.defaults.format);
    console.log('');
    for (const fp of saveResult.filePaths) {
      console.log(chalk.green(`  ✓ Saved: ${fp}`));
    }

    if (options.open || config.autoOpen) {
      for (const fp of saveResult.filePaths) {
        openFile(fp);
      }
    }

    if (config.history.enabled) {
      addHistoryEntry({
        provider: result.provider,
        model: result.model,
        prompt: enhancedPrompt,
        type: 'music',
        duration,
        /* v8 ignore next */
        format: request.format || 'wav',
        outputFiles: saveResult.filePaths,
        elapsed: result.elapsed,
        cost,
      });
    }

    if (cost > 0) {
      console.log(chalk.dim(`  Cost: ~$${cost.toFixed(4)}`));
    }
    console.log('');
  } catch (error: any) {
    spinner.fail('Music generation failed');
    console.error(chalk.red(`\n  ${error.message}\n`));
    process.exit(1);
  }
}
