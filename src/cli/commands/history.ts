import { Command } from 'commander';
import { getHistory, clearHistory, getHistoryEntry } from '../../core/history.js';

export const historyCommand = new Command('history')
  .description('View generation history');

historyCommand
  .command('list')
  .description('List recent generations')
  .option('-l, --limit <number>', 'Number of entries', '20')
  .action(async (options: { limit: string }) => {
    const chalk = (await import('chalk')).default;
    /* v8 ignore next */
    const entries = getHistory(parseInt(options.limit) || 20);

    if (entries.length === 0) {
      console.log(chalk.dim('\n  No generation history yet.\n'));
      return;
    }

    console.log(chalk.bold('\n  🔊 Generation History\n'));
    for (const entry of entries.reverse()) {
      const typeIcon = entry.type === 'music' ? '🎵' : '🔊';
      console.log(`  ${typeIcon} ${chalk.cyan(entry.id)} ${chalk.dim(entry.timestamp.slice(0, 16))}`);
      console.log(chalk.dim(`    ${entry.provider}/${entry.model} · ${entry.duration}s · ${entry.format}`));
      console.log(chalk.dim(`    "${entry.prompt.slice(0, 60)}${entry.prompt.length > 60 ? '...' : ''}"`));
      if (entry.cost) console.log(chalk.dim(`    Cost: $${entry.cost.toFixed(4)}`));
      console.log('');
    }
  });

historyCommand
  .command('show <id>')
  .description('Show details of a history entry')
  .action(async (id: string) => {
    const chalk = (await import('chalk')).default;
    const entry = getHistoryEntry(id);
    if (!entry) {
      console.log(chalk.red(`\n  ✗ Entry "${id}" not found\n`));
      return;
    }
    console.log(chalk.bold(`\n  Entry: ${entry.id}`));
    console.log(`  Type:     ${entry.type}`);
    console.log(`  Provider: ${entry.provider}`);
    console.log(`  Model:    ${entry.model}`);
    console.log(`  Prompt:   "${entry.prompt}"`);
    console.log(`  Duration: ${entry.duration}s`);
    console.log(`  Format:   ${entry.format}`);
    console.log(`  Elapsed:  ${(entry.elapsed / 1000).toFixed(1)}s`);
    if (entry.cost) console.log(`  Cost:     $${entry.cost.toFixed(4)}`);
    console.log(`  Files:`);
    for (const f of entry.outputFiles) {
      console.log(`    ${f}`);
    }
    console.log('');
  });

historyCommand
  .command('clear')
  .description('Clear all history')
  .action(async () => {
    const chalk = (await import('chalk')).default;
    clearHistory();
    console.log(chalk.green('\n  ✓ History cleared\n'));
  });
