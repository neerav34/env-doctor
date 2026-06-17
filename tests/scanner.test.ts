import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanProjectFiles } from '../src/core/scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

describe('scanProjectFiles', () => {
  it('finds text files in node-project fixture', async () => {
    const { files } = await scanProjectFiles(path.join(fixturesDir, 'node-project'));
    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.endsWith('.ts'))).toBe(true);
  });

  it('returns skippedFiles count', async () => {
    const { skippedFiles } = await scanProjectFiles(path.join(fixturesDir, 'node-project'));
    expect(typeof skippedFiles).toBe('number');
    expect(skippedFiles).toBeGreaterThanOrEqual(0);
  });

  it('excludes .env files from source scan', async () => {
    const { files } = await scanProjectFiles(path.join(fixturesDir, 'node-project'));
    // .env should not be in source file list (glob excludes **/.env pattern)
    expect(files.every(f => !f.match(/^\.env$/))).toBe(true);
  });

  it('respects additional ignore patterns', async () => {
    const { files } = await scanProjectFiles(path.join(fixturesDir, 'node-project'), {
      ignore: ['**/*.ts'],
    });
    expect(files.every(f => !f.endsWith('.ts'))).toBe(true);
  });

  it('handles non-existent directory gracefully', async () => {
    await expect(
      scanProjectFiles('/nonexistent/path/that/does/not/exist')
    ).resolves.toBeDefined();
  });
});
