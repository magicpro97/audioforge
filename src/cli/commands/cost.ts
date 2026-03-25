import { Command } from 'commander';
import { getAllPricing } from '../../core/pricing.js';
import { getHistory } from '../../core/history.js';

export const costCommand = new Command('cost')
  .description('Track generation costs');

costCommand
  .command('summary')
  .description('Show total spending summary')
  .action(async () => {
    const chalk = (await import('chalk')).default;
    const entries = getHistory();
    const byProvider: Record<string, { count: number; cost: number }> = {};
    let totalCost = 0;
    let totalCount = 0;

    for (const e of entries) {
      const cost = e.cost || 0;
      if (!byProvider[e.provider]) {
        byProvider[e.provider] = { count: 0, cost: 0 };
      }
      byProvider[e.provider].count++;
      byProvider[e.provider].cost += cost;
      totalCost += cost;
      totalCount++;
    }

    console.log(chalk.bold('\n  🔊 Cost Summary\n'));
    if (totalCount === 0) {
      console.log(chalk.dim('  No generations recorded yet.\n'));
      return;
    }

    for (const [provider, data] of Object.entries(byProvider)) {
      console.log(`  ${chalk.cyan(provider)}: ${data.count} generations · $${data.cost.toFixed(4)}`);
    }
    console.log('');
    console.log(chalk.bold(`  Total: ${totalCount} generations · $${totalCost.toFixed(4)}`));
    console.log('');
  });

costCommand
  .command('pricing')
  .description('Show per-provider pricing')
  .action(async () => {
    const chalk = (await import('chalk')).default;
    const pricing = getAllPricing();

    console.log(chalk.bold('\n  🔊 Provider Pricing (per ~5s of audio)\n'));
    for (const [provider, models] of Object.entries(pricing)) {
      console.log(`  ${chalk.cyan(provider)}:`);
      for (const [model, price] of Object.entries(models)) {
        if (model.startsWith('_')) continue;
        console.log(`    ${model}: $${price.toFixed(4)}`);
      }
      console.log('');
    }
  });
