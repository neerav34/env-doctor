import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { parseEnvContent } from '../core/parser.js';
import { setColorEnabled, logger } from '../utils/logger.js';
import { resolveRoot } from '../utils/glob.js';

const execAsync = promisify(exec);

export interface DiffOptions {
  exampleFile: string;
  noColor: boolean;
  root: string;
  format: 'pretty' | 'json';
}

interface DiffResult {
  added: string[];
  removed: string[];
  modified: string[];
  file: string;
}

async function getGitCommittedContent(root: string, relPath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`git show HEAD:"${relPath}"`, { cwd: root });
    return stdout;
  } catch {
    return null;
  }
}

async function isGitRepo(root: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: root });
    return true;
  } catch {
    return false;
  }
}

export async function runDiff(options: DiffOptions): Promise<void> {
  setColorEnabled(!options.noColor);

  const root = resolveRoot(options.root);
  const relPath = options.exampleFile;
  const absPath = path.resolve(root, relPath);

  if (!(await isGitRepo(root))) {
    logger.warn('  Not a git repository.\n');
    process.exit(1);
  }

  const committedContent = await getGitCommittedContent(root, relPath);

  // Parse current working copy
  let currentContent: string;
  try {
    const { readFile } = await import('fs/promises');
    currentContent = await readFile(absPath, 'utf-8');
  } catch {
    logger.warn(`  ${relPath} not found.\n`);
    process.exit(1);
  }

  const currentVars = parseEnvContent(currentContent, relPath, true);

  if (committedContent === null) {
    // File is new — all vars are "added"
    const added = Array.from(currentVars.keys()).sort();
    if (options.format === 'json') {
      process.stdout.write(JSON.stringify({ file: relPath, added, removed: [], modified: [] }, null, 2) + '\n');
      process.exit(0);
    }
    logger.log(`\n  ${chalk.dim(relPath)} ${chalk.dim('(new file)')}\n`);
    for (const v of added) logger.log(`  ${chalk.green('+')}  ${v}`);
    logger.log(`\n  ${chalk.green(`${added.length} variable${added.length === 1 ? '' : 's'} added`)}\n`);
    process.exit(0);
  }

  const committedVars = parseEnvContent(committedContent, relPath, true);

  const result: DiffResult = { added: [], removed: [], modified: [], file: relPath };

  for (const [name, current] of currentVars) {
    if (!committedVars.has(name)) {
      result.added.push(name);
    } else {
      const committed = committedVars.get(name);
      if (committed?.value !== current.value) {
        result.modified.push(name);
      }
    }
  }

  for (const name of committedVars.keys()) {
    if (!currentVars.has(name)) result.removed.push(name);
  }

  result.added.sort();
  result.removed.sort();
  result.modified.sort();

  if (options.format === 'json') {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(result.added.length + result.removed.length + result.modified.length > 0 ? 1 : 0);
  }

  const total = result.added.length + result.removed.length + result.modified.length;

  logger.log(`\n  ${chalk.bold(relPath)} vs HEAD\n`);

  if (total === 0) {
    logger.success('  No changes since last commit.\n');
    process.exit(0);
  }

  for (const v of result.added) logger.log(`  ${chalk.green('+')}  ${chalk.green(v)}`);
  for (const v of result.removed) logger.log(`  ${chalk.red('-')}  ${chalk.red(v)}`);
  for (const v of result.modified) logger.log(`  ${chalk.yellow('~')}  ${chalk.yellow(v)}  ${chalk.dim('(value changed)')}`);

  const parts = [];
  if (result.added.length) parts.push(chalk.green(`+${result.added.length} added`));
  if (result.removed.length) parts.push(chalk.red(`-${result.removed.length} removed`));
  if (result.modified.length) parts.push(chalk.yellow(`~${result.modified.length} modified`));

  logger.log(`\n  ${parts.join('  ')}\n`);
  process.exit(1);
}
