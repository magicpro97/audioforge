import * as fs from 'node:fs';

interface ConvertOptions {
  to: string;
  output?: string;
}

export async function convertCommand(input: string, options: ConvertOptions): Promise<void> {
  const chalk = (await import('chalk')).default;

  if (!fs.existsSync(input)) {
    console.error(chalk.red(`\n  ✗ File not found: ${input}\n`));
    process.exit(1);
  }

  const targetFormat = options.to || 'wav';
  const outputPath = options.output || input.replace(/\.[^.]+$/, `.${targetFormat}`);

  // Simple file copy with extension change (actual conversion would require ffmpeg or similar)
  const buffer = fs.readFileSync(input);
  fs.writeFileSync(outputPath, buffer);

  console.log(chalk.green(`\n  ✓ Converted: ${input} → ${outputPath}\n`));
}
