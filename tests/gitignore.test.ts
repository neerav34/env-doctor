import { describe, it, expect } from 'vitest';
import { parseGitignorePatterns } from '../src/utils/gitignore.js';

describe('parseGitignorePatterns', () => {
  it('skips empty lines', () => {
    const patterns = parseGitignorePatterns('\n\n\n');
    expect(patterns).toHaveLength(0);
  });

  it('skips comment lines', () => {
    const patterns = parseGitignorePatterns('# This is a comment\n# Another comment\n');
    expect(patterns).toHaveLength(0);
  });

  it('converts directory patterns (trailing /) to glob', () => {
    const patterns = parseGitignorePatterns('dist/\n');
    expect(patterns.some(p => p.includes('dist'))).toBe(true);
  });

  it('converts simple filenames to glob patterns', () => {
    const patterns = parseGitignorePatterns('.DS_Store\n');
    expect(patterns.some(p => p.includes('.DS_Store'))).toBe(true);
  });

  it('skips negated patterns (!)', () => {
    const patterns = parseGitignorePatterns('!important.env\n');
    expect(patterns).toHaveLength(0);
  });

  it('handles rooted patterns (starting with /)', () => {
    const patterns = parseGitignorePatterns('/build\n');
    expect(patterns.some(p => p.includes('build'))).toBe(true);
  });

  it('handles multiple patterns', () => {
    const content = '*.log\nnode_modules/\n.env\n';
    const patterns = parseGitignorePatterns(content);
    expect(patterns.length).toBeGreaterThan(0);
  });
});
