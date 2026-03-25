import { Command } from 'commander';
import { loadConfig, setConfigValue, getConfigValue, getConfigFilePath } from '../../core/config.js';

export const configCommand = new Command('config')
  .description('Manage AudioForge configuration');

configCommand
  .command('set <key> <value>')
  .description('Set a configuration value (dot notation: elevenlabs.apiKey)')
  .action(async (key: string, value: string) => {
    const chalk = (await import('chalk')).default;
    setConfigValue(key, value);
    const display = key.toLowerCase().includes('apikey') || key.toLowerCase().includes('key')
      ? `${value.slice(0, 6)}...${value.slice(-4)}`
      : value;
    console.log(chalk.green(`\n  ✓ Set ${key} = ${display}\n`));
  });

configCommand
  .command('get <key>')
  .description('Get a configuration value')
  .action(async (key: string) => {
    const chalk = (await import('chalk')).default;
    const value = getConfigValue(key);
    if (value === undefined) {
      console.log(chalk.yellow(`\n  Key "${key}" not found\n`));
    } else {
      console.log(`\n  ${key} = ${JSON.stringify(value)}\n`);
    }
  });

configCommand
  .command('list')
  .description('Show all configuration')
  .action(async () => {
    const chalk = (await import('chalk')).default;
    const config = loadConfig();
    console.log(chalk.bold('\n  🔊 AudioForge Configuration'));
    console.log(chalk.dim(`  File: ${getConfigFilePath()}\n`));

    function printObj(obj: any, prefix = ''): void {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          printObj(value, fullKey);
        } else {
          const display = fullKey.toLowerCase().includes('apikey') && typeof value === 'string' && value.length > 10
            ? `${(value as string).slice(0, 6)}...${(value as string).slice(-4)}`
            : JSON.stringify(value);
          console.log(`  ${chalk.cyan(fullKey)} = ${display}`);
        }
      }
    }

    printObj(config);
    console.log('');
  });
