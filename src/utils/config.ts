import { readFile } from 'fs/promises';
import path from 'path';

export interface EnvDoctorConfig {
  envFile?: string;
  exampleFile?: string;
  ignore?: string[];
  strict?: boolean;
  format?: 'pretty' | 'json' | 'markdown';
  monorepo?: boolean;
}

const CONFIG_FILENAMES = [
  '.env-doctor.json',
  'env-doctor.config.json',
];

export async function loadConfig(root: string): Promise<EnvDoctorConfig> {
  for (const filename of CONFIG_FILENAMES) {
    try {
      const raw = await readFile(path.join(root, filename), 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      return validateConfig(parsed, filename);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      if (err instanceof SyntaxError) {
        throw new Error(`Invalid JSON in ${filename}: ${err.message}`);
      }
      throw err;
    }
  }
  return {};
}

function validateConfig(raw: unknown, filename: string): EnvDoctorConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${filename} must be a JSON object`);
  }

  const obj = raw as Record<string, unknown>;
  const config: EnvDoctorConfig = {};

  if ('envFile' in obj) {
    if (typeof obj['envFile'] !== 'string') throw new Error(`${filename}: envFile must be a string`);
    config.envFile = obj['envFile'];
  }
  if ('exampleFile' in obj) {
    if (typeof obj['exampleFile'] !== 'string') throw new Error(`${filename}: exampleFile must be a string`);
    config.exampleFile = obj['exampleFile'];
  }
  if ('ignore' in obj) {
    if (!Array.isArray(obj['ignore']) || !obj['ignore'].every(i => typeof i === 'string')) {
      throw new Error(`${filename}: ignore must be an array of strings`);
    }
    config.ignore = obj['ignore'];
  }
  if ('strict' in obj) {
    if (typeof obj['strict'] !== 'boolean') throw new Error(`${filename}: strict must be a boolean`);
    config.strict = obj['strict'];
  }
  if ('format' in obj) {
    if (!['pretty', 'json', 'markdown'].includes(obj['format'] as string)) {
      throw new Error(`${filename}: format must be one of: pretty, json, markdown`);
    }
    config.format = obj['format'] as EnvDoctorConfig['format'];
  }
  if ('monorepo' in obj) {
    if (typeof obj['monorepo'] !== 'boolean') throw new Error(`${filename}: monorepo must be a boolean`);
    config.monorepo = obj['monorepo'];
  }

  return config;
}

// Merge config file values with CLI options — CLI always wins
export function mergeConfig<T extends Record<string, unknown>>(
  cliOptions: T,
  config: EnvDoctorConfig,
  defaults: Record<string, unknown>
): T {
  const merged = { ...cliOptions };

  for (const [key, value] of Object.entries(config)) {
    // Only apply config value if CLI option matches its default (user didn't explicitly set it)
    if (merged[key] === defaults[key]) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}
