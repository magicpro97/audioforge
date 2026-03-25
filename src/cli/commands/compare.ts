import * as fs from 'node:fs';
import { createProvider, getAllProviderNames } from '../../providers/index.js';
import { loadConfig, getProviderApiKey } from '../../core/config.js';
import { saveAudio } from '../../core/output.js';

interface CompareOptions {
  providers?: string;
  duration?: string;
  output?: string;
}

export async function compareCommand(prompt: string, options: CompareOptions): Promise<void> {
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;

  const config = loadConfig();
  /* v8 ignore next */
  const duration = parseInt(options.duration || '5') || 5;

  const providerNames = options.providers
    ? options.providers.split(',').map(p => p.trim())
    : getAllProviderNames().filter(name => {
        const key = getProviderApiKey(name);
        return key && key.length > 0;
      });

  if (providerNames.length === 0) {
    console.error(chalk.red('\n  ✗ No configured providers found. Configure at least one API key.\n'));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold('  🔊 AudioForge - Provider Comparison'));
  /* v8 ignore next */
  console.log(chalk.dim(`  Prompt: "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`));
  console.log(chalk.dim(`  Providers: ${providerNames.join(', ')}`));
  console.log('');

  const outputDir = options.output || './audioforge-compare';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const name of providerNames) {
    const spinner = ora({ text: `Generating with ${name}...`, indent: 2 }).start();
    try {
      const provider = createProvider(name);
      const apiKey = getProviderApiKey(name);
      if (apiKey) provider.configure(apiKey);

      const result = await provider.generate({ prompt, duration });
      const saved = saveAudio(result, `${outputDir}/${name}.wav`);
      spinner.succeed(`${name}: ${(result.elapsed / 1000).toFixed(1)}s → ${saved.filePaths[0]}`);
    } catch (err: any) {
      spinner.fail(`${name}: ${err.message}`);
    }
  }
  console.log('');
}
