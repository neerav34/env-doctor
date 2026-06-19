import path from 'path';
import { writeFile, readFile } from 'fs/promises';
import chalk from 'chalk';
import { parseEnvFile } from '../core/parser.js';
import { scanProjectFiles } from '../core/scanner.js';
import { detectVarsInFile } from '../core/detector.js';
import { analyze } from '../core/analyzer.js';
import { reportPretty, reportJson, reportMarkdown } from '../core/reporter.js';
import { setColorEnabled, logger } from '../utils/logger.js';
import { resolveRoot } from '../utils/glob.js';
import { findPackageRoots } from '../utils/monorepo.js';
import { discoverEnvFiles } from '../utils/env-files.js';
import type { CheckOptions, ScanResult, EnvVarReference, EnvVarDefinition } from '../types/index.js';

async function runPackageScan(root: string, options: CheckOptions): Promise<ScanResult> {
  const exampleFilePath = path.resolve(root, options.exampleFile);

  const start = Date.now();

  // If user explicitly passed --env-file, use only that file.
  // Otherwise auto-discover all common .env variants and merge them.
  const isDefaultEnvFile = options.envFile === '.env';
  const envFilePaths = isDefaultEnvFile
    ? (await discoverEnvFiles(root)).map(f => path.resolve(root, f))
    : [path.resolve(root, options.envFile)];

  if (envFilePaths.length === 0) {
    envFilePaths.push(path.resolve(root, '.env'));
  }

  const [envResults, exampleResult] = await Promise.all([
    Promise.all(envFilePaths.map(f => parseEnvFile(f, false))),
    parseEnvFile(exampleFilePath, true),
  ]);

  // Merge all env files — first occurrence of a key wins
  const mergedEnvVars = new Map<string, EnvVarDefinition>();
  for (const result of envResults) {
    for (const [key, def] of result.vars) {
      if (!mergedEnvVars.has(key)) mergedEnvVars.set(key, def);
    }
  }

  const { files, skippedFiles } = await scanProjectFiles(root, {
    ignore: options.ignore,
    respectGitignore: true,
  });

  const refResults = await Promise.allSettled(
    files.map(file => detectVarsInFile(root, file))
  );

  const foundVars = new Map<string, EnvVarReference[]>();
  for (const result of refResults) {
    if (result.status !== 'fulfilled') continue;
    for (const ref of result.value) {
      const existing = foundVars.get(ref.name) ?? [];
      existing.push(ref);
      foundVars.set(ref.name, existing);
    }
  }

  const issues = analyze({
    foundVars,
    envVars: mergedEnvVars,
    exampleVars: exampleResult.vars,
  });

  return {
    projectRoot: root,
    scannedFiles: files.length,
    skippedFiles,
    foundVars,
    envVars: mergedEnvVars,
    exampleVars: exampleResult.vars,
    issues,
    duration: Date.now() - start,
  };
}

async function runMonorepoCheck(options: CheckOptions): Promise<void> {
  const root = resolveRoot(options.root);
  const packages = await findPackageRoots(root, options.ignore);

  if (packages.length === 0) {
    logger.warn('  No packages found. Are you in a monorepo root?\n');
    process.exit(0);
    return;
  }

  logger.header(`\n  Monorepo scan — ${packages.length} package${packages.length === 1 ? '' : 's'} found\n`);

  const results: Array<{ pkg: string; result: ScanResult }> = [];

  for (const pkg of packages) {
    const pkgRoot = path.join(root, pkg);
    const result = await runPackageScan(pkgRoot, options);
    results.push({ pkg, result });
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalFiles = 0;

  for (const { pkg, result } of results) {
    const errors = result.issues.filter(i => i.severity === 'error');
    const warnings = result.issues.filter(i => i.severity === 'warn');
    totalErrors += errors.length;
    totalWarnings += warnings.length;
    totalFiles += result.scannedFiles;

    const icon = errors.length > 0 ? '❌' : warnings.length > 0 ? '⚠️ ' : '✓ ';
    logger.bold(`  ${icon}  ${chalk.cyan(pkg)}`);

    if (result.issues.length === 0) {
      logger.success('       All checks passed\n');
    } else {
      for (const issue of result.issues) {
        const issueIcon = issue.severity === 'error' ? chalk.red('  ❌') : chalk.yellow('  ⚠️ ');
        logger.log(`    ${issueIcon}  ${chalk.bold(issue.variable.padEnd(20))}  ${chalk.dim(issue.message)}`);
      }
      logger.log('');
    }
  }

  const sep = '─'.repeat(52);
  logger.dim_(`  ${sep}`);
  const summary = [
    `${packages.length} package${packages.length === 1 ? '' : 's'}`,
    totalErrors > 0 ? chalk.red(`${totalErrors} error${totalErrors === 1 ? '' : 's'}`) : '0 errors',
    totalWarnings > 0 ? chalk.yellow(`${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}`) : '0 warnings',
    `${totalFiles} files`,
  ].join(' · ');
  logger.log(`\n  ${summary}\n`);

  const hasErrors = totalErrors > 0;
  const hasWarns = totalWarnings > 0;
  if (hasErrors || (options.strict && hasWarns)) process.exit(1);
  else if (hasWarns) process.exit(2);
  else process.exit(0);
}

export async function runCheck(options: CheckOptions): Promise<void> {
  setColorEnabled(!options.noColor);

  if (options.monorepo) {
    await runMonorepoCheck(options);
    return;
  }

  const root = resolveRoot(options.root);
  const exampleFilePath = path.resolve(root, options.exampleFile);

  const result = await runPackageScan(root, options);

  if (options.fix) {
    await applyFix(result, exampleFilePath);
  }

  switch (options.format) {
    case 'json':
      reportJson(result);
      break;
    case 'markdown':
      reportMarkdown(result);
      break;
    default:
      reportPretty(result);
  }

  const hasErrors = result.issues.some(i => i.severity === 'error');
  const hasWarns = result.issues.some(i => i.severity === 'warn');
  if (hasErrors || (options.strict && hasWarns)) process.exit(1);
  else if (hasWarns) process.exit(2);
  else process.exit(0);
}

async function applyFix(result: ScanResult, exampleFilePath: string): Promise<void> {
  const { foundVars, exampleVars } = result;

  const newVars: string[] = [];
  for (const [name] of foundVars) {
    if (!exampleVars.has(name)) newVars.push(name);
  }

  if (newVars.length === 0) return;

  let existing = '';
  try {
    existing = await readFile(exampleFilePath, 'utf-8');
  } catch {
    // File doesn't exist yet
  }

  const additions = newVars
    .sort()
    .map(name => {
      const refs = result.foundVars.get(name) ?? [];
      const firstRef = refs[0];
      const comment = firstRef ? ` # referenced in ${firstRef.file}:${firstRef.line}` : '';
      return `${name}=${comment}`;
    })
    .join('\n');

  const newContent = existing
    ? existing.trimEnd() + '\n\n# Added by env-doctor check --fix\n' + additions + '\n'
    : additions + '\n';

  await writeFile(exampleFilePath, newContent, 'utf-8');
  console.log(`\n  Fixed: added ${newVars.length} variable(s) to .env.example`);
}
