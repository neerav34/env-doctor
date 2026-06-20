import path from 'path';
import chalk from 'chalk';
import { parseEnvFileRaw } from '../core/parser.js';
import { auditRawVars } from '../core/auditor.js';
import { discoverEnvFiles } from '../utils/env-files.js';
import { setColorEnabled, logger } from '../utils/logger.js';
import { resolveRoot } from '../utils/glob.js';

export interface AuditOptions {
  envFile: string;
  noColor: boolean;
  root: string;
  format: 'pretty' | 'json';
}

export async function runAudit(options: AuditOptions): Promise<void> {
  setColorEnabled(!options.noColor);

  const root = resolveRoot(options.root);

  const isDefault = options.envFile === '.env';
  const envFiles = isDefault
    ? (await discoverEnvFiles(root)).map(f => path.resolve(root, f))
    : [path.resolve(root, options.envFile)];

  if (envFiles.length === 0) envFiles.push(path.resolve(root, '.env'));

  const allVars = new Map<string, { name: string; file: string; line: number; value: string }>();
  for (const f of envFiles) {
    const parsed = await parseEnvFileRaw(f);
    for (const [key, val] of parsed) {
      if (!allVars.has(key)) allVars.set(key, val);
    }
  }

  if (allVars.size === 0) {
    logger.warn('  No env files found or all are empty.\n');
    process.exit(0);
  }

  const findings = auditRawVars(allVars);

  if (options.format === 'json') {
    process.stdout.write(JSON.stringify({ findings }, null, 2) + '\n');
    process.exit(findings.some(f => f.severity === 'error') ? 1 : findings.length > 0 ? 2 : 0);
  }

  const scanned = envFiles.map(f => path.relative(root, f)).join(', ');
  logger.log(`\n  Auditing ${chalk.dim(scanned)}\n`);

  if (findings.length === 0) {
    logger.success('  No credential patterns found.\n');
    process.exit(0);
  }

  for (const f of findings) {
    const icon = f.severity === 'error' ? chalk.red('❌') : chalk.yellow('⚠️ ');
    const rel = path.relative(root, f.file);
    logger.log(`  ${icon}  ${chalk.bold(f.variable.padEnd(24))}  ${chalk.cyan(f.credentialType)}`);
    logger.log(`         ${chalk.dim(`${rel}:${f.line}`)}`);
    logger.log(`         ${chalk.dim(f.suggestion)}\n`);
  }

  const errors = findings.filter(f => f.severity === 'error').length;
  const warns = findings.filter(f => f.severity === 'warn').length;
  const parts = [];
  if (errors) parts.push(chalk.red(`${errors} credential${errors === 1 ? '' : 's'} found`));
  if (warns) parts.push(chalk.yellow(`${warns} warning${warns === 1 ? '' : 's'}`));
  logger.log(`  ${parts.join(' · ')}\n`);

  process.exit(errors > 0 ? 1 : 2);
}
