import fg from 'fast-glob';
import path from 'path';
import { loadGitignorePatterns } from './gitignore.js';

const ALWAYS_IGNORE: string[] = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/vendor/**',
  '**/target/**',
  '**/bin/**',
  '**/obj/**',
  '**/.cache/**',
  '**/__pycache__/**',
  '**/*.pyc',
  '**/*.min.js',
  '**/*.min.css',
  '**/*.map',
  '**/*.lock',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  // Exclude .env files from source scanning — they're parsed separately by parser.ts
  '.env',
  '**/.env',
  '.env.*',
  '**/.env.*',
];

export interface FindFilesOptions {
  ignore?: string[];
  respectGitignore?: boolean;
}

export async function findSourceFiles(
  root: string,
  options: FindFilesOptions = {}
): Promise<string[]> {
  const { ignore = [], respectGitignore = true } = options;

  const gitignorePatterns = respectGitignore
    ? await loadGitignorePatterns(root)
    : [];

  const allIgnore = [...ALWAYS_IGNORE, ...gitignorePatterns, ...ignore];

  const files = await fg('**/*', {
    cwd: root,
    ignore: allIgnore,
    absolute: false,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  return files.sort();
}

export function resolveRoot(providedRoot?: string): string {
  if (providedRoot) {
    return path.resolve(providedRoot);
  }
  return process.cwd();
}
