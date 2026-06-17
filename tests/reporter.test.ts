import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildJsonOutput } from '../src/core/reporter.js';
import type { ScanResult } from '../src/types/index.js';

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    projectRoot: '/test',
    scannedFiles: 10,
    skippedFiles: 0,
    foundVars: new Map(),
    envVars: new Map(),
    exampleVars: new Map(),
    issues: [],
    duration: 50,
    ...overrides,
  };
}

describe('buildJsonOutput', () => {
  it('reports success: true when no errors', () => {
    const result = buildJsonOutput(makeScanResult());
    expect(result.success).toBe(true);
  });

  it('reports success: false when there are errors', () => {
    const result = buildJsonOutput(
      makeScanResult({
        issues: [
          {
            severity: 'error',
            type: 'missing',
            variable: 'MISSING_VAR',
            message: 'MISSING_VAR is missing',
          },
        ],
      })
    );
    expect(result.success).toBe(false);
  });

  it('counts errors and warnings separately', () => {
    const result = buildJsonOutput(
      makeScanResult({
        issues: [
          { severity: 'error', type: 'missing', variable: 'E1', message: '' },
          { severity: 'error', type: 'missing', variable: 'E2', message: '' },
          { severity: 'warn', type: 'unused', variable: 'W1', message: '' },
        ],
      })
    );
    expect(result.summary.errors).toBe(2);
    expect(result.summary.warnings).toBe(1);
  });

  it('includes scannedFiles in summary', () => {
    const result = buildJsonOutput(makeScanResult({ scannedFiles: 42 }));
    expect(result.summary.scannedFiles).toBe(42);
  });

  it('includes duration in summary', () => {
    const result = buildJsonOutput(makeScanResult({ duration: 123 }));
    expect(result.summary.duration).toBe(123);
  });

  it('serializes issue references correctly', () => {
    const result = buildJsonOutput(
      makeScanResult({
        issues: [
          {
            severity: 'error',
            type: 'missing',
            variable: 'MY_VAR',
            message: 'test',
            references: [
              { name: 'MY_VAR', file: 'src/a.ts', line: 5, column: 10, pattern: 'js', context: 'process.env.MY_VAR' },
            ],
          },
        ],
      })
    );
    expect(result.issues[0]?.references?.[0]?.file).toBe('src/a.ts');
    expect(result.issues[0]?.references?.[0]?.line).toBe(5);
  });
});
