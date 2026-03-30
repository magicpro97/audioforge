import { createProvider, getAllProviderNames } from '../../providers/index.js';
import { loadConfig, getProviderApiKey } from '../../core/config.js';
import { saveAudio } from '../../core/output.js';
import { addHistoryEntry } from '../../core/history.js';
import { applyPreset, STYLE_PRESETS } from '../../core/presets.js';
import { resolveDuration } from '../../core/durations.js';
import { estimateCost } from '../../core/pricing.js';
import { getTemplate, renderTemplate } from '../../core/templates.js';
import { openFile } from '../../core/opener.js';
import { getPlatformSpec } from '../../core/platforms.js';
import type { AudioGenerationRequest } from '../../types/index.js';

interface GenerateOptions {
  provider?: string;
  model?: string;
  duration?: string;
  output?: string;
  format?: string;
  seed?: string;
  preset?: string;
  loop?: boolean;
  open?: boolean;
  template?: string;
  var?: string[];
  platform?: string;
  dryRun?: boolean;
}

export async function generateCommand(prompt: string, options: GenerateOptions): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  const config = loadConfig();

  // Handle template
  if (options.template) {
    const tmpl = getTemplate(options.template);
    if (!tmpl) {
      console.error(chalk.red(`\n  ✗ Template "${options.template}" not found. Run: audioforge template list\n`));
      process.exit(1);
    }
    const vars: Record<string, string> = {};
    for (const v of options.var || []) {
      const [key, ...rest] = v.split('=');
      vars[key] = rest.join('=');
    }
    try {
      prompt = renderTemplate(tmpl, vars);
    } catch (err: any) {
      console.error(chalk.red(`\n  ✗ ${err.message}\n`));
      process.exit(1);
    }
    if (tmpl.provider && !options.provider) options.provider = tmpl.provider;
    if (tmpl.model && !options.model) options.model = tmpl.model;
    if (tmpl.duration && !options.duration) options.duration = String(tmpl.duration);
    if (tmpl.preset && !options.preset) options.preset = tmpl.preset;
  }

  // Apply style preset
  const presetName = options.preset || config.defaults.preset;
  if (presetName && STYLE_PRESETS[presetName]) {
    prompt = applyPreset(prompt, presetName);
  }

  // Resolve duration
  let duration = config.defaults.duration;
  if (options.duration) {
    const resolved = resolveDuration(options.duration);
    if (resolved !== null) {
      duration = resolved;
    } else {
      console.error(chalk.red(`\n  ✗ Invalid duration "${options.duration}"\n`));
      process.exit(1);
    }
  }

  const providerName = options.provider || config.defaults.provider;
  const provider = createProvider(providerName);

  // Configure API key
  const apiKey = getProviderApiKey(providerName);
  if (apiKey) {
    provider.configure(apiKey);
  } else if (provider.info.requiresKey) {
    console.error(chalk.red(`\n  ✗ No API key configured for "${providerName}".`));
    console.error(chalk.yellow(`  → Run: audioforge config set ${providerName}.apiKey <your-key>`));
    console.error(chalk.dim(`  → Get key at: ${provider.info.website}\n`));
    process.exit(1);
  }

  // Resolve platform spec
  const platformSpec = options.platform ? getPlatformSpec(options.platform) : undefined;
  if (options.platform && !platformSpec) {
    console.error(chalk.red(`\n  ✗ Unknown platform "${options.platform}". Valid: ios, android, web, game\n`));
    process.exit(1);
  }

  // Platform sets format if not explicitly overridden by --format
  const resolvedFormat = (options.format as any) || (platformSpec?.format) || config.defaults.format;

  const request: AudioGenerationRequest = {
    prompt,
    model: options.model || config.defaults.model || undefined,
    duration,
    format: resolvedFormat,
    loop: options.loop,
    seed: options.seed ? parseInt(options.seed) : undefined,
  };

  console.log('');
  console.log(chalk.bold('  🔊 AudioForge - AI Audio Generator'));
  console.log(chalk.dim(`  Provider: ${provider.info.displayName}`));
  console.log(chalk.dim(`  Model:    ${request.model || 'default'}`));
  console.log(chalk.dim(`  Duration: ${duration}s`));
  if (presetName) console.log(chalk.dim(`  Preset:   ${presetName}`));
  if (platformSpec) console.log(chalk.dim(`  Platform: ${platformSpec.name} (${platformSpec.description})`));
  console.log(chalk.dim(`  Prompt:   "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`));
  console.log('');

  // Dry run — show cost estimate without generating
  if (options.dryRun) {
    const cost = estimateCost(providerName, request.model || '', { duration });
    console.log(chalk.cyan(`  💰 Estimated cost: ~$${cost.toFixed(4)}`));
    console.log(chalk.dim('  (dry run — no API call made)\n'));
    return;
  }

  const spinner = ora({ text: 'Generating audio...', indent: 2 }).start();

  try {
    const result = await provider.generate(request);
    spinner.succeed(`Generated ${result.audio.length} audio file(s) in ${(result.elapsed / 1000).toFixed(1)}s`);

    // Estimate cost
    const cost = estimateCost(providerName, request.model || '', { duration });
    result.cost = cost;

    // Save audio
    const saveResult = saveAudio(result, options.output, resolvedFormat);
    console.log('');
    for (const fp of saveResult.filePaths) {
      console.log(chalk.green(`  ✓ Saved: ${fp}`));
    }

    // Auto-open
    if (options.open || config.autoOpen) {
      for (const fp of saveResult.filePaths) {
        openFile(fp);
      }
    }

    // Add to history
    if (config.history.enabled) {
      addHistoryEntry({
        provider: result.provider,
        model: result.model,
        prompt,
        type: 'sfx',
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
    spinner.fail('Generation failed');
    console.error(chalk.red(`\n  ${error.message}\n`));
    process.exit(1);
  }
}
