import { Command } from 'commander';
import { saveTemplate, getTemplate, getAllTemplates, deleteTemplate } from '../../core/templates.js';

export const templateCommand = new Command('template')
  .description('Manage prompt templates');

templateCommand
  .command('save <name> <prompt>')
  .description('Save a prompt template (use {var} for variables)')
  .option('-p, --provider <name>', 'Default provider')
  .option('-d, --duration <seconds>', 'Default duration')
  .option('--preset <style>', 'Default style preset')
  .option('--type <sfx|music>', 'Audio type')
  .action(async (name: string, prompt: string, options: any) => {
    const chalk = (await import('chalk')).default;
    const entry = saveTemplate(name, prompt, {
      provider: options.provider,
      duration: options.duration ? parseInt(options.duration) : undefined,
      preset: options.preset,
      type: options.type,
    });
    console.log(chalk.green(`\n  ✓ Template "${name}" saved`));
    if (entry.variables.length) {
      console.log(chalk.dim(`  Variables: ${entry.variables.join(', ')}`));
    }
    console.log('');
  });

templateCommand
  .command('list')
  .description('List all templates')
  .action(async () => {
    const chalk = (await import('chalk')).default;
    const templates = getAllTemplates();
    if (templates.length === 0) {
      console.log(chalk.dim('\n  No templates saved yet.\n'));
      return;
    }
    console.log(chalk.bold('\n  🔊 Templates\n'));
    for (const t of templates) {
      /* v8 ignore next */
      console.log(`  ${chalk.cyan(t.name)}: "${t.prompt.slice(0, 50)}${t.prompt.length > 50 ? '...' : ''}"`);
      if (t.variables.length) console.log(chalk.dim(`    Variables: ${t.variables.join(', ')}`));
      console.log('');
    }
  });

templateCommand
  .command('show <name>')
  .description('Show template details')
  .action(async (name: string) => {
    const chalk = (await import('chalk')).default;
    const t = getTemplate(name);
    if (!t) {
      console.log(chalk.red(`\n  ✗ Template "${name}" not found\n`));
      return;
    }
    console.log(chalk.bold(`\n  Template: ${t.name}`));
    console.log(`  Prompt:    "${t.prompt}"`);
    /* v8 ignore next */
    console.log(`  Variables: ${t.variables.length ? t.variables.join(', ') : '(none)'}`);
    if (t.provider) console.log(`  Provider:  ${t.provider}`);
    if (t.duration) console.log(`  Duration:  ${t.duration}s`);
    if (t.preset) console.log(`  Preset:    ${t.preset}`);
    if (t.type) console.log(`  Type:      ${t.type}`);
    console.log('');
  });

templateCommand
  .command('delete <name>')
  .description('Delete a template')
  .action(async (name: string) => {
    const chalk = (await import('chalk')).default;
    if (deleteTemplate(name)) {
      console.log(chalk.green(`\n  ✓ Template "${name}" deleted\n`));
    } else {
      console.log(chalk.red(`\n  ✗ Template "${name}" not found\n`));
    }
  });
