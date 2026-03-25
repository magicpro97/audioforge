import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TemplateEntry } from '../types/index.js';
import { getConfigDir } from './config.js';

const TEMPLATES_FILE = path.join(getConfigDir(), 'templates.json');

function loadTemplates(): TemplateEntry[] {
  try {
    if (!fs.existsSync(TEMPLATES_FILE)) return [];
    return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveTemplates(templates: TemplateEntry[]): void {
  const dir = path.dirname(TEMPLATES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
}

function extractVariables(prompt: string): string[] {
  const matches = prompt.match(/\{(\w+)\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1, -1)))];
}

export function saveTemplate(name: string, prompt: string, options?: Partial<TemplateEntry>): TemplateEntry {
  const templates = loadTemplates();
  const existing = templates.findIndex(t => t.name === name);

  const entry: TemplateEntry = {
    name,
    prompt,
    variables: extractVariables(prompt),
    ...options,
  };

  if (existing >= 0) {
    templates[existing] = entry;
  } else {
    templates.push(entry);
  }

  saveTemplates(templates);
  return entry;
}

export function getTemplate(name: string): TemplateEntry | undefined {
  return loadTemplates().find(t => t.name === name);
}

export function getAllTemplates(): TemplateEntry[] {
  return loadTemplates();
}

export function deleteTemplate(name: string): boolean {
  const templates = loadTemplates();
  const idx = templates.findIndex(t => t.name === name);
  if (idx < 0) return false;
  templates.splice(idx, 1);
  saveTemplates(templates);
  return true;
}

export function renderTemplate(template: TemplateEntry, vars: Record<string, string>): string {
  let result = template.prompt;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  const unresolved = result.match(/\{(\w+)\}/g);
  if (unresolved) {
    throw new Error(`Unresolved template variables: ${unresolved.join(', ')}`);
  }
  return result;
}
