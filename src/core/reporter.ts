import type { Issue, ScanResult, HealthReport } from '../types/index.js';
import { logger } from '../utils/logger.js';

// ─── Pretty Format ────────────────────────────────────────────────────────────

export function reportPretty(result: ScanResult): void {
  const { issues, scannedFiles, skippedFiles, duration } = result;
  const errors = issues.filter(i => i.severity === 'error');
  const warns = issues.filter(i => i.severity === 'warn');

  console.log('');

  if (errors.length === 0 && warns.length === 0) {
    logger.success(`  ✓  All environment variables are properly configured`);
    printStats(scannedFiles, skippedFiles, duration);
    return;
  }

  if (errors.length > 0) {
    console.log(logger.bold(logger.red(`  ERRORS (${errors.length})`)));
    console.log('');
    for (const issue of errors) {
      printIssuePretty(issue, 'error');
    }
  }

  if (warns.length > 0) {
    console.log(logger.bold(logger.yellow(`  WARNINGS (${warns.length})`)));
    console.log('');
    for (const issue of warns) {
      printIssuePretty(issue, 'warn');
    }
  }

  printStats(scannedFiles, skippedFiles, duration);
}

function printIssuePretty(issue: Issue, level: 'error' | 'warn'): void {
  const icon = level === 'error' ? logger.red('  ✗') : logger.yellow('  ⚠');
  const typeLbl = formatIssueType(issue.type);
  const varName = level === 'error'
    ? logger.bold(logger.red(issue.variable))
    : logger.bold(logger.yellow(issue.variable));

  console.log(`${icon}  ${varName}  ${logger.gray(`[${typeLbl}]`)}`);
  console.log(`     ${logger.gray(issue.message)}`);

  if (issue.references) {
    for (const ref of issue.references.slice(0, 3)) {
      console.log(`     ${logger.dim_('└─')} ${logger.cyan(`${ref.file}:${ref.line}`)}  ${logger.dim_(ref.context)}`);
    }
    if (issue.references.length > 3) {
      console.log(`     ${logger.dim_(`   ... and ${issue.references.length - 3} more`)}`);
    }
  }

  if (issue.definition) {
    const loc = `${issue.definition.file}:${issue.definition.line}`;
    console.log(`     ${logger.dim_('└─')} ${logger.cyan(loc)}`);
  }

  if (issue.suggestion) {
    console.log(`     ${logger.green('→')} ${issue.suggestion}`);
  }

  console.log('');
}

function printStats(scannedFiles: number, skippedFiles: number, duration: number): void {
  console.log('');
  console.log(
    logger.dim_(
      `  Scanned ${scannedFiles} files` +
      (skippedFiles > 0 ? ` (${skippedFiles} skipped)` : '') +
      ` in ${duration}ms`
    )
  );
  console.log('');
}

function formatIssueType(type: string): string {
  const labels: Record<string, string> = {
    missing: 'Missing Required',
    unused: 'Unused Variable',
    'example-drift': 'Example Drift',
    'type-mismatch': 'Type Mismatch',
  };
  return labels[type] ?? type;
}

// ─── JSON Format ──────────────────────────────────────────────────────────────

export interface JsonOutput {
  success: boolean;
  summary: {
    errors: number;
    warnings: number;
    scannedFiles: number;
    skippedFiles: number;
    duration: number;
  };
  issues: Array<{
    severity: string;
    type: string;
    variable: string;
    message: string;
    references?: Array<{ file: string; line: number; column: number; context: string }>;
    definition?: { file: string; line: number };
    suggestion?: string;
  }>;
}

export function buildJsonOutput(result: ScanResult): JsonOutput {
  return {
    success: result.issues.filter(i => i.severity === 'error').length === 0,
    summary: {
      errors: result.issues.filter(i => i.severity === 'error').length,
      warnings: result.issues.filter(i => i.severity === 'warn').length,
      scannedFiles: result.scannedFiles,
      skippedFiles: result.skippedFiles,
      duration: result.duration,
    },
    issues: result.issues.map(issue => ({
      severity: issue.severity,
      type: issue.type,
      variable: issue.variable,
      message: issue.message,
      ...(issue.references !== undefined
        ? { references: issue.references.map(r => ({ file: r.file, line: r.line, column: r.column, context: r.context })) }
        : {}),
      ...(issue.definition !== undefined
        ? { definition: { file: issue.definition.file, line: issue.definition.line } }
        : {}),
      ...(issue.suggestion !== undefined ? { suggestion: issue.suggestion } : {}),
    })),
  };
}

export function reportJson(result: ScanResult): void {
  console.log(JSON.stringify(buildJsonOutput(result), null, 2));
}

// ─── Markdown Format ─────────────────────────────────────────────────────────

export function reportMarkdown(result: ScanResult): void {
  const { issues, scannedFiles, duration } = result;
  const errors = issues.filter(i => i.severity === 'error');
  const warns = issues.filter(i => i.severity === 'warn');
  const lines: string[] = [];

  lines.push('## Environment Variable Report');
  lines.push('');

  if (errors.length === 0 && warns.length === 0) {
    lines.push('✅ All environment variables are properly configured.');
  } else {
    const badge = errors.length > 0 ? '🔴' : '🟡';
    lines.push(`${badge} **${errors.length} error(s), ${warns.length} warning(s)**`);
    lines.push('');

    if (errors.length > 0) {
      lines.push('### Errors');
      lines.push('');
      for (const issue of errors) {
        lines.push(issueToMarkdown(issue));
      }
    }

    if (warns.length > 0) {
      lines.push('### Warnings');
      lines.push('');
      for (const issue of warns) {
        lines.push(issueToMarkdown(issue));
      }
    }
  }

  lines.push('---');
  lines.push(`_Scanned ${scannedFiles} files in ${duration}ms_`);

  console.log(lines.join('\n'));
}

function issueToMarkdown(issue: Issue): string {
  const parts: string[] = [];
  const icon = issue.severity === 'error' ? '❌' : '⚠️';
  parts.push(`#### ${icon} \`${issue.variable}\``);
  parts.push('');
  parts.push(issue.message);

  if (issue.references && issue.references.length > 0) {
    parts.push('');
    parts.push('**References:**');
    for (const ref of issue.references) {
      parts.push(`- \`${ref.file}:${ref.line}\` — \`${ref.context}\``);
    }
  }

  if (issue.suggestion) {
    parts.push('');
    parts.push(`> 💡 ${issue.suggestion}`);
  }

  parts.push('');
  return parts.join('\n');
}

// ─── Doctor Format ────────────────────────────────────────────────────────────

export function reportDoctor(result: ScanResult, health: HealthReport): void {
  const scoreColor = health.score >= 80 ? logger.green : health.score >= 50 ? logger.yellow : logger.red;
  const scoreIcon = health.score >= 80 ? '✓' : health.score >= 50 ? '⚠' : '✗';

  console.log('');
  console.log(logger.bold('  ENVIRONMENT HEALTH REPORT'));
  console.log('');
  console.log(`  Health Score: ${scoreColor(`${health.score}/100`)} ${scoreIcon}`);
  console.log('');

  if (health.breakdown.length > 0) {
    console.log(logger.bold('  Breakdown:'));
    for (const item of health.breakdown) {
      const pts = item.points > 0 ? logger.red(`-${item.points} pts`) : logger.green('0 pts');
      console.log(`    ${item.label.padEnd(25)} ${String(item.count).padStart(3)}  (${pts})`);
    }
    console.log('');
  }

  if (health.mostProblematicFiles.length > 0) {
    console.log(logger.bold('  Most Problematic Files:'));
    health.mostProblematicFiles.forEach((f, idx) => {
      console.log(`    ${idx + 1}. ${logger.cyan(f.file)}  ${logger.gray(`(${f.issueCount} issue${f.issueCount === 1 ? '' : 's'})`)}`);
    });
    console.log('');
  }

  if (health.recommendations.length > 0) {
    console.log(logger.bold('  Recommendations:'));
    for (const rec of health.recommendations) {
      console.log(`    ${logger.green('→')} ${rec}`);
    }
    console.log('');
  }

  // Also show all issues
  reportPretty(result);
}
