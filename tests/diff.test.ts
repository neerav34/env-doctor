import { describe, it, expect } from 'vitest';
import { parseEnvContent } from '../src/core/parser.js';

// Test the core diff logic used by the diff command
function computeDiff(currentContent: string, committedContent: string, file = '.env.example') {
  const current = parseEnvContent(currentContent, file, true);
  const committed = parseEnvContent(committedContent, file, true);

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const [name, cur] of current) {
    if (!committed.has(name)) {
      added.push(name);
    } else if (committed.get(name)?.value !== cur.value) {
      modified.push(name);
    }
  }
  for (const name of committed.keys()) {
    if (!current.has(name)) removed.push(name);
  }

  return { added: added.sort(), removed: removed.sort(), modified: modified.sort() };
}

describe('diff logic', () => {
  it('detects no changes when files are identical', () => {
    const content = 'DATABASE_URL=\nSTRIPE_KEY=\n';
    const result = computeDiff(content, content);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  it('detects added variable', () => {
    const current = 'DATABASE_URL=\nNEW_VAR=\n';
    const committed = 'DATABASE_URL=\n';
    const result = computeDiff(current, committed);
    expect(result.added).toEqual(['NEW_VAR']);
    expect(result.removed).toHaveLength(0);
  });

  it('detects removed variable', () => {
    const current = 'DATABASE_URL=\n';
    const committed = 'DATABASE_URL=\nOLD_VAR=\n';
    const result = computeDiff(current, committed);
    expect(result.removed).toEqual(['OLD_VAR']);
    expect(result.added).toHaveLength(0);
  });

  it('detects modified variable value', () => {
    const current = 'PORT=3000\n';
    const committed = 'PORT=8080\n';
    const result = computeDiff(current, committed);
    expect(result.modified).toEqual(['PORT']);
  });

  it('handles multiple changes at once', () => {
    const current = 'DATABASE_URL=\nNEW_VAR=\nPORT=3000\n';
    const committed = 'DATABASE_URL=\nOLD_VAR=\nPORT=8080\n';
    const result = computeDiff(current, committed);
    expect(result.added).toEqual(['NEW_VAR']);
    expect(result.removed).toEqual(['OLD_VAR']);
    expect(result.modified).toEqual(['PORT']);
  });

  it('returns sorted variable names', () => {
    const current = 'Z_VAR=\nA_VAR=\nM_VAR=\n';
    const committed = '';
    const result = computeDiff(current, committed);
    expect(result.added).toEqual(['A_VAR', 'M_VAR', 'Z_VAR']);
  });
});
