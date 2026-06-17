import path from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { parseEnvFile } from '../core/parser.js';
import { scanProjectFiles } from '../core/scanner.js';
import { detectVarsInFile } from '../core/detector.js';
import { analyze } from '../core/analyzer.js';
import { reportDoctor } from '../core/reporter.js';
import { setColorEnabled } from '../utils/logger.js';
import { resolveRoot } from '../utils/glob.js';
import type { DoctorOptions, ScanResult, EnvVarReference, HealthReport } from '../types/index.js';

const SEVERITY_POINTS = { error: 10, warn: 3, info: 0 } as const;
const CACHE_DIR = '.env-doctor';
const CACHE_FILE = 'cache.json';

interface CacheEntry {
  timestamp: string;
  healthScore: number;
  errorCount: number;
  warnCount: number;
}

export async function runDoctor(options: DoctorOptions): Promise<void> {
  setColorEnabled(!options.noColor);

  const root = resolveRoot(options.root);
  const envFilePath = path.resolve(root, options.envFile);
  const exampleFilePath = path.resolve(root, options.exampleFile);

  const start = Date.now();

  const [envResult, exampleResult] = await Promise.all([
    parseEnvFile(envFilePath, false),
    parseEnvFile(exampleFilePath, true),
  ]);

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

  const health = buildHealthReport(scanResult);

  // Load and compare previous scan if available
  const previous = await loadCache(root);
  if (previous) {
    const delta = health.score - previous.healthScore;
    const trend = delta > 0 ? `+${delta}` : String(delta);
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
    console.log(`\n  Trend: ${arrow} ${trend} pts from last scan (${previous.timestamp})`);
  }

  await saveCache(root, health);

  reportDoctor(scanResult, health);

  const hasErrors = issues.some(i => i.severity === 'error');
  const hasWarns = issues.some(i => i.severity === 'warn');

  if (hasErrors || (options.strict && hasWarns)) {
    process.exit(1);
  } else if (hasWarns) {
    process.exit(2);
  }
}

function buildHealthReport(result: ScanResult): HealthReport {
  const { issues } = result;

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warn').length;

  const totalPoints =
    errorCount * SEVERITY_POINTS.error + warnCount * SEVERITY_POINTS.warn;

  const score = Math.max(0, 100 - totalPoints);

  // Breakdown by issue type
  const typeCounts: Record<string, number> = {};
  for (const issue of issues) {
    typeCounts[issue.type] = (typeCounts[issue.type] ?? 0) + 1;
  }

  const breakdown = Object.entries(typeCounts).map(([type, count]) => {
    const pts = issues
      .filter(i => i.type === type)
      .reduce((sum, i) => sum + SEVERITY_POINTS[i.severity], 0);
    return {
      label: formatTypeLabel(type),
      count,
      points: pts,
    };
  });

  // Most problematic files
  const fileCounts = new Map<string, number>();
  for (const issue of issues) {
    for (const ref of issue.references ?? []) {
      fileCounts.set(ref.file, (fileCounts.get(ref.file) ?? 0) + 1);
    }
  }

  const mostProblematicFiles = [...fileCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([file, issueCount]) => ({ file, issueCount }));

  // Recommendations
  const recommendations: string[] = [];
  if (issues.some(i => i.type === 'missing' && i.severity === 'error')) {
    recommendations.push('Run `env-doctor check --fix` to update .env.example');
  }
  const unusedVars = issues.filter(i => i.type === 'unused').map(i => i.variable);
  if (unusedVars.length > 0) {
    const list = unusedVars.slice(0, 3).join(', ');
    const more = unusedVars.length > 3 ? ` (+${unusedVars.length - 3} more)` : '';
    recommendations.push(`Review unused variables: ${list}${more}`);
  }
  if (issues.some(i => i.type === 'example-drift')) {
    recommendations.push('Run `env-doctor init` to regenerate .env.example from current code');
  }

  return {
    score,
    errorCount,
    warnCount,
    breakdown,
    mostProblematicFiles,
    recommendations,
  };
}

function formatTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    missing: 'Missing Required',
    unused: 'Unused Variables',
    'example-drift': 'Example Drift',
    'type-mismatch': 'Type Mismatches',
  };
  return labels[type] ?? type;
}

async function loadCache(root: string): Promise<CacheEntry | null> {
  const cachePath = path.join(root, CACHE_DIR, CACHE_FILE);
  try {
    const raw = await readFile(cachePath, 'utf-8');
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

async function saveCache(root: string, health: HealthReport): Promise<void> {
  const cacheDir = path.join(root, CACHE_DIR);
  const cachePath = path.join(cacheDir, CACHE_FILE);

  try {
    await mkdir(cacheDir, { recursive: true });
    const entry: CacheEntry = {
      timestamp: new Date().toISOString(),
      healthScore: health.score,
      errorCount: health.errorCount,
      warnCount: health.warnCount,
    };
    await writeFile(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
  } catch {
    // Non-fatal — cache failure shouldn't break the command
  }
}
