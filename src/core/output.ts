import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AudioGenerationResult } from '../types/index.js';
import { loadConfig } from './config.js';

export interface SaveResult {
  filePaths: string[];
}

export function saveAudio(result: AudioGenerationResult, outputPath?: string, format?: string): SaveResult {
  const config = loadConfig();
  /* v8 ignore next */
  const ext = format || config.defaults.format || 'wav';
  const outputDir = outputPath
    ? path.dirname(outputPath)
    : config.output.directory;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePaths: string[] = [];
  const timestamp = Date.now();

  for (let i = 0; i < result.audio.length; i++) {
    const audio = result.audio[i];
    if (!audio.base64) continue;

    let filePath: string;
    if (outputPath && result.audio.length === 1) {
      filePath = outputPath;
    } else if (outputPath && result.audio.length > 1) {
      const fileExt = path.extname(outputPath);
      const base = path.basename(outputPath, fileExt);
      const dir = path.dirname(outputPath);
      filePath = path.join(dir, `${base}-${i + 1}${fileExt}`);
    } else {
      const pattern = config.output.namingPattern;
      const modelClean = result.model.replace(/[/\\:]/g, '-');
      const name = pattern
        .replace('{provider}', result.provider)
        .replace('{model}', modelClean)
        .replace('{timestamp}', String(timestamp));
      const suffix = result.audio.length > 1 ? `-${i + 1}` : '';
      filePath = path.join(outputDir, `${name}${suffix}.${ext}`);
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = Buffer.from(audio.base64, 'base64');
    fs.writeFileSync(filePath, buffer);
    audio.localPath = path.resolve(filePath);
    filePaths.push(audio.localPath);
  }

  return { filePaths };
}
