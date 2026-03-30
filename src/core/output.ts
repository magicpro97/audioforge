import { saveOutputFiles, type SaveResult } from '@magicpro97/forge-core';
import type { AudioGenerationResult } from '../types/index.js';
import { loadConfig } from './config.js';

export type { SaveResult };

export function saveAudio(result: AudioGenerationResult, outputPath?: string, format?: string): SaveResult {
  const config = loadConfig();
  /* v8 ignore next */
  const ext = format || config.defaults.format || 'wav';

  const saved = saveOutputFiles(result.audio, {
    outputPath,
    outputDir: config.output.directory,
    namingPattern: config.output.namingPattern,
    provider: result.provider,
    model: result.model,
    extension: ext,
  });

  return saved;
}
