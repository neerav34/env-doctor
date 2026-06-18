import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { findPackageRoots } from '../src/utils/monorepo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures/monorepo-project');

describe('findPackageRoots', () => {
  it('finds all packages in a monorepo fixture', async () => {
    const roots = await findPackageRoots(FIXTURE);
    expect(roots).toContain('apps/api');
    expect(roots).toContain('apps/frontend');
    expect(roots).toContain('packages/shared');
  });

  it('returns relative paths sorted alphabetically', async () => {
    const roots = await findPackageRoots(FIXTURE);
    expect(roots).toEqual([...roots].sort());
  });

  it('does not include the root itself', async () => {
    const roots = await findPackageRoots(FIXTURE);
    expect(roots).not.toContain('.');
    expect(roots).not.toContain('');
  });

  it('returns empty array when no packages found', async () => {
    const roots = await findPackageRoots(path.join(FIXTURE, 'apps/api'));
    expect(roots).toHaveLength(0);
  });
});
