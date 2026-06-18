import fg from 'fast-glob';
import path from 'path';

const MANIFEST_FILES = [
  'package.json',
  'go.mod',
  'Cargo.toml',
  'pyproject.toml',
  'Gemfile',
];

const ALWAYS_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/target/**',
  '**/vendor/**',
  '**/__pycache__/**',
  '**/coverage/**',
];

export async function findPackageRoots(root: string, extraIgnore: string[] = []): Promise<string[]> {
  const patterns = MANIFEST_FILES.map(f => `**/${f}`);

  const files = await fg(patterns, {
    cwd: root,
    ignore: [...ALWAYS_IGNORE, ...extraIgnore],
    deep: 5,
  });

  const dirs = new Set(
    files
      .map(f => path.dirname(f))
      .filter(d => d !== '.'),
  );

  return Array.from(dirs).sort();
}
