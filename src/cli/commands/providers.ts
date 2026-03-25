import { Command } from 'commander';
import { createAllProviders } from '../../providers/index.js';
import { getProviderApiKey } from '../../core/config.js';

export const providersCommand = new Command('providers')
  .description('Manage audio providers');

providersCommand
  .command('list')
  .description('List all available providers')
  .action(async () => {
    const chalk = (await import('chalk')).default;
    const providers = createAllProviders();

    console.log(chalk.bold('\n  🔊 AudioForge Providers\n'));

    for (const [, provider] of providers) {
      const info = provider.info;
      const apiKey = getProviderApiKey(info.name);
      const configured = !info.requiresKey || (apiKey && apiKey.length > 0);
      const statusIcon = configured ? chalk.green('✓') : chalk.red('✗');
      const statusText = configured ? chalk.green('configured') : chalk.red('needs API key');

      console.log(`  ${statusIcon} ${chalk.bold(info.displayName)}`);
      console.log(chalk.dim(`    ${info.description}`));
      console.log(chalk.dim(`    Models: ${info.models.join(', ')}`));
      /* v8 ignore next */
      const caps = info.capabilities || {};
      const capList = Object.entries(caps).filter(([, v]) => v).map(([k]) => k);
      if (capList.length) console.log(chalk.dim(`    Capabilities: ${capList.join(', ')}`));
      console.log(`    Status: ${statusText}`);
      if (!configured) {
        console.log(chalk.yellow(`    → audioforge config set ${info.name}.apiKey <key>`));
        console.log(chalk.dim(`    → ${info.website}`));
      }
      console.log('');
    }
  });
