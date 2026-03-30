import * as fs from 'node:fs';
import { createProvider } from '../../providers/index.js';
import { loadConfig, getProviderApiKey } from '../../core/config.js';
import { saveAudio } from '../../core/output.js';
import { estimateCost } from '../../core/pricing.js';

interface BatchOptions {
  dryRun?: boolean;
}

interface BatchItem {
  prompt: string;
  type?: 'sfx' | 'music';
  provider?: string;
  model?: string;
  duration?: number;
  output?: string;
  format?: string;
}

export async function batchCommand(file: string, options: BatchOptions): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;
  const { parse } = await import('yaml');

  if (!fs.existsSync(file)) {
    console.error(chalk.red(`\n  ✗ File not found: ${file}\n`));
    process.exit(1);
  }

  const raw = fs.readFileSync(file, 'utf-8');
  let items: BatchItem[];

  try {
    const parsed = file.endsWith('.json') ? JSON.parse(raw) : parse(raw);
    /* v8 ignore next */
    items = Array.isArray(parsed) ? parsed : parsed.items || parsed.batch || [];
  } catch (err: any) {
    console.error(chalk.red(`\n  ✗ Failed to parse ${file}: ${err.message}\n`));
    process.exit(1);
  }

  console.log(chalk.bold(`\n  🔊 AudioForge - Batch Processing (${items.length} items)\n`));

  if (options.dryRun) {
    for (const item of items) {
      console.log(chalk.dim(`  [DRY RUN] ${item.type || 'sfx'}: "${item.prompt.slice(0, 50)}..." → ${item.provider || 'default'}`));
    }
    console.log('');
    return;
  }

  const config = loadConfig();
  let succeeded = 0;
  let failed = 0;
  let totalCost = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const spinner = ora({ text: `[${i + 1}/${items.length}] "${item.prompt.slice(0, 40)}..."`, indent: 2 }).start();

    try {
      const providerName = item.provider || config.defaults.provider;
      const provider = createProvider(providerName);
      const apiKey = getProviderApiKey(providerName);
      if (apiKey) provider.configure(apiKey);

      const request = {
        prompt: item.prompt,
        model: item.model,
        duration: item.duration || config.defaults.duration,
        format: (item.format as any) || config.defaults.format,
      };

      const result = item.type === 'music'
        ? await provider.generateMusic(request)
        : await provider.generate(request);

      saveAudio(result, item.output, item.format || config.defaults.format);
      const cost = estimateCost(providerName, request.model || '', { duration: request.duration });
      totalCost += cost;
      spinner.succeed(`[${i + 1}/${items.length}] Done`);
      succeeded++;
    } catch (err: any) {
      spinner.fail(`[${i + 1}/${items.length}] Failed: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(chalk.bold(`  Results: ${chalk.green(`${succeeded} succeeded`)}, ${failed > 0 ? chalk.red(`${failed} failed`) : '0 failed'}`));
  if (totalCost > 0) {
    console.log(chalk.dim(`  Estimated cost: $${totalCost.toFixed(4)}`));
  }
  console.log('');
}
