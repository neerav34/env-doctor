import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import { createInterface } from 'readline/promises';
import chalk from 'chalk';
import { parseEnvFile } from '../core/parser.js';
import { parseEnvFileRaw } from '../core/parser.js';
import { setColorEnabled, logger } from '../utils/logger.js';
import { resolveRoot } from '../utils/glob.js';
import type { SyncOptions } from '../types/index.js';

export async function runSync(options: SyncOptions): Promise<void> {
  setColorEnabled(!options.noColor);

  const root        = resolveRoot(options.root);
  const envPath     = path.resolve(root, options.envFile);
  const examplePath = path.resolve(root, options.exampleFile);

  const { vars: exampleVars, exists: exampleExists } = await parseEnvFile(examplePath, true);
  if (!exampleExists || exampleVars.size === 0) {
    logger.error(`\n  ${options.exampleFile} not found or empty. Run env-doctor init first.\n`);
    process.exit(3);
  }

  const existingVars = await parseEnvFileRaw(envPath);
  const missing      = [...exampleVars.keys()].filter(k => !existingVars.has(k));

  if (missing.length === 0) {
    logger.log('');
    logger.success(`  Already in sync — .env has all keys from ${options.exampleFile} ✓\n`);
    process.exit(0);
  }

  logger.header(`\n  env-doctor sync\n`);
  logger.log(`  ${chalk.dim(`${missing.length} key${missing.length === 1 ? '' : 's'} missing from .env — press Enter to leave blank\n`)}`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answers: Array<{ key: string; value: string }> = [];

  rl.on('SIGINT', () => {
    process.stdout.write('\n');
    rl.close();
    process.exit(0);
  });

  try {
    for (const key of missing) {
      const value = await rl.question(`  ${chalk.cyan(key)}: `);
      answers.push({ key, value: value.trim() });
    }
  } finally {
    rl.close();
  }

  let existing = '';
  try { existing = await readFile(envPath, 'utf-8'); } catch { /* file doesn't exist yet */ }

  const separator = existing && !existing.endsWith('\n') ? '\n' : '';
  const additions = answers.map(({ key, value }) => `${key}=${value}`).join('\n');
  await writeFile(envPath, existing + separator + additions + '\n', 'utf-8');

  logger.log('');
  logger.success(`  Added ${answers.length} key${answers.length === 1 ? '' : 's'} to .env ✓\n`);
  process.exit(0);
}
