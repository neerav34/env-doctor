import path from 'path';
import { writeFile, readFile } from 'fs/promises';
import { parseEnvFile } from '../core/parser.js';
import { scanProjectFiles } from '../core/scanner.js';
import { detectVarsInFile } from '../core/detector.js';
import { analyze } from '../core/analyzer.js';
import { reportPretty, reportJson, reportMarkdown } from '../core/reporter.js';
import { setColorEnabled } from '../utils/logger.js';
import { resolveRoot } from '../utils/glob.js';
import type { CheckOptions, ScanResult, EnvVarReference } from '../types/index.js';

export async function runCheck(options: CheckOptions): Promise<void> {
  const { format, noColor, strict, fix } = options;

  setColorEnabled(!noColor);

  const root = resolveRoot(options.root);
  const envFilePath = path.resolve(root, options.envFile);
  const exampleFilePath = path.resolve(root, options.exampleFile);

  const start = Date.now();

  // Step 1: Parse .env and .env.example
  const [envResult, exampleResult] = await Promise.all([
    parseEnvFile(envFilePath, false),
    parseEnvFile(exampleFilePath, true),
  ]);

  // Step 2: Scan source files
  const { files, skippedFiles } = await scanProjectFiles(root, {
    ignore: options.ignore,
    respectGitignore: true,
  });

  // Step 3: Detect env var references in all files (parallel)
  const refResults = await Promise.allSettled(
    files.map(file => detectVarsInFile(root, file))
  );

  // Step 4: Aggregate references
  const foundVars = new Map<string, EnvVarReference[]>();
  for (const result of refResults) {
    if (result.status !== 'fulfilled') continue;
    for (const ref of result.value) {
      const existing = foundVars.get(ref.name) ?? [];
      existing.push(ref);
      foundVars.set(ref.name, existing);
    }
  }

  // Step 5: Analyze
  const issues = analyze({
    foundVars,
    envVars: envResult.vars,
    exampleVars: exampleResult.vars,
  });

  const duration = Date.now() - start;

  const scanResult: ScanResult = {
    projectRoot: root,
    scannedFiles: files.length,
    skippedFiles,
    foundVars,
    envVars: envResult.vars,
    exampleVars: exampleResult.vars,
    issues,
    duration,
  };

  // Step 6: Auto-fix .env.example if requested
  if (fix) {
    await applyFix(scanResult, exampleFilePath);
  }

  // Step 7: Report output
  switch (format) {
    case 'json':
      reportJson(scanResult);
      break;
    case 'markdown':
      reportMarkdown(scanResult);
      break;
    default:
      reportPretty(scanResult);
  }

  // Step 8: Exit with appropriate code
  const hasErrors = issues.some(i => i.severity === 'error');
  const hasWarns = issues.some(i => i.severity === 'warn');

  if (hasErrors || (strict && hasWarns)) {
    process.exit(1);
  } else if (hasWarns) {
    process.exit(2);
  } else {
    process.exit(0);
  }
}

async function applyFix(result: ScanResult, exampleFilePath: string): Promise<void> {
  const { foundVars, exampleVars } = result;

  // Collect vars referenced in code but missing from .env.example
  const newVars: string[] = [];
  for (const [name] of foundVars) {
    if (!exampleVars.has(name)) {
      newVars.push(name);
    }
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
  console.log(`\n  Fixed: added ${newVars.length} variable(s) to ${result.exampleVars.size > 0 ? exampleFilePath : '.env.example'}`);
}
