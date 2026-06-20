import { Command, Option } from 'commander';
import { runCheck } from './commands/check.js';
import { runInit } from './commands/init.js';
import { runDoctor } from './commands/doctor.js';
import { runAudit } from './commands/audit.js';
import { runDiff } from './commands/diff.js';
import type { CheckOptions, InitOptions } from './types/index.js';

const DEFAULT_IGNORE = ['node_modules', 'dist', '.git'];

const program = new Command();

program
  .name('env-doctor')
  .description('The eslint of environment variables — catch missing env vars before they hit production')
  .version('1.0.0');

// ─── check command ────────────────────────────────────────────────────────────

program
  .command('check')
  .description('Scan codebase and report environment variable discrepancies')
  .option('--fix', 'Auto-update .env.example to match code references', false)
  .option('--strict', 'Treat warnings as errors (exit 1)', false)
  .option('--env-file <path>', 'Path to .env file', '.env')
  .option('--example-file <path>', 'Path to .env.example file', '.env.example')
  .option('--ignore <patterns...>', 'Additional glob patterns to skip', DEFAULT_IGNORE)
  .option('--no-color', 'Disable ANSI color output')
  .option('--root <path>', 'Project root directory (default: cwd)')
  .option('--monorepo', 'Scan each package in a monorepo independently', false)
  .addOption(
    new Option('--format <format>', 'Output format').choices(['pretty', 'json', 'markdown']).default('pretty')
  )
  .action(async (opts: Record<string, unknown>) => {
    const options: CheckOptions = {
      fix: Boolean(opts['fix']),
      strict: Boolean(opts['strict']),
      envFile: String(opts['envFile'] ?? '.env'),
      exampleFile: String(opts['exampleFile'] ?? '.env.example'),
      ignore: Array.isArray(opts['ignore']) ? (opts['ignore'] as string[]) : DEFAULT_IGNORE,
      format: (opts['format'] as CheckOptions['format']) ?? 'pretty',
      noColor: !opts['color'],
      root: String(opts['root'] ?? ''),
      monorepo: Boolean(opts['monorepo']),
    };
    await runCheck(options).catch(fatalError);
  });

// ─── init command ─────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Generate or update .env.example from code references and .env')
  .option('--env-file <path>', 'Path to .env file', '.env')
  .option('--example-file <path>', 'Path to .env.example file', '.env.example')
  .option('--ignore <patterns...>', 'Additional glob patterns to skip', DEFAULT_IGNORE)
  .option('--with-comments', 'Add source file comments to each variable', false)
  .option('--no-color', 'Disable ANSI color output')
  .option('--root <path>', 'Project root directory (default: cwd)')
  .action(async (opts: Record<string, unknown>) => {
    const options: InitOptions = {
      envFile: String(opts['envFile'] ?? '.env'),
      exampleFile: String(opts['exampleFile'] ?? '.env.example'),
      ignore: Array.isArray(opts['ignore']) ? (opts['ignore'] as string[]) : DEFAULT_IGNORE,
      withComments: Boolean(opts['withComments']),
      noColor: !opts['color'],
      root: String(opts['root'] ?? ''),
    };
    await runInit(options).catch(fatalError);
  });

// ─── doctor command ───────────────────────────────────────────────────────────

program
  .command('doctor')
  .description('Full diagnostic with health score and trend analysis')
  .option('--strict', 'Treat warnings as errors (exit 1)', false)
  .option('--env-file <path>', 'Path to .env file', '.env')
  .option('--example-file <path>', 'Path to .env.example file', '.env.example')
  .option('--ignore <patterns...>', 'Additional glob patterns to skip', DEFAULT_IGNORE)
  .option('--no-color', 'Disable ANSI color output')
  .option('--root <path>', 'Project root directory (default: cwd)')
  .addOption(
    new Option('--format <format>', 'Output format').choices(['pretty', 'json', 'markdown']).default('pretty')
  )
  .action(async (opts: Record<string, unknown>) => {
    const options = {
      fix: false,
      strict: Boolean(opts['strict']),
      envFile: String(opts['envFile'] ?? '.env'),
      exampleFile: String(opts['exampleFile'] ?? '.env.example'),
      ignore: Array.isArray(opts['ignore']) ? (opts['ignore'] as string[]) : DEFAULT_IGNORE,
      format: (opts['format'] as CheckOptions['format']) ?? 'pretty',
      noColor: !opts['color'],
      root: String(opts['root'] ?? ''),
      monorepo: false,
    };
    await runDoctor(options).catch(fatalError);
  });

// ─── diff command ─────────────────────────────────────────────────────────────

program
  .command('diff')
  .description('Show what changed in .env.example since the last git commit')
  .option('--example-file <path>', 'Path to .env.example file', '.env.example')
  .option('--no-color', 'Disable ANSI color output')
  .option('--root <path>', 'Project root directory (default: cwd)')
  .addOption(
    new Option('--format <format>', 'Output format').choices(['pretty', 'json']).default('pretty')
  )
  .action(async (opts: Record<string, unknown>) => {
    await runDiff({
      exampleFile: String(opts['exampleFile'] ?? '.env.example'),
      noColor: !opts['color'],
      root: String(opts['root'] ?? ''),
      format: (opts['format'] as 'pretty' | 'json') ?? 'pretty',
    }).catch(fatalError);
  });

// ─── audit command ────────────────────────────────────────────────────────────

program
  .command('audit')
  .description('Scan .env files for real credential values (API keys, tokens, passwords)')
  .option('--env-file <path>', 'Path to .env file', '.env')
  .option('--no-color', 'Disable ANSI color output')
  .option('--root <path>', 'Project root directory (default: cwd)')
  .addOption(
    new Option('--format <format>', 'Output format').choices(['pretty', 'json']).default('pretty')
  )
  .action(async (opts: Record<string, unknown>) => {
    await runAudit({
      envFile: String(opts['envFile'] ?? '.env'),
      noColor: !opts['color'],
      root: String(opts['root'] ?? ''),
      format: (opts['format'] as 'pretty' | 'json') ?? 'pretty',
    }).catch(fatalError);
  });

function fatalError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\n  Fatal error: ${message}\n\n`);
  process.exit(3);
}

program.parseAsync(process.argv).catch(fatalError);
