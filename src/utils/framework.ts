import { access, readFile } from 'fs/promises';
import path from 'path';

export type Framework = 'nextjs' | 'vite' | 'cra' | 'none';

export interface FrameworkInfo {
  framework: Framework;
  publicPrefix: string | null;
  label: string | null;
}

const SECRET_KEYWORDS = [
  'SECRET', 'PRIVATE', 'PASSWORD', 'PWD', 'CREDENTIAL',
  'TOKEN', 'AUTH', 'CERT', 'KEY',
];

export function looksLikeSecret(varName: string): boolean {
  const upper = varName.toUpperCase();
  return SECRET_KEYWORDS.some(kw => upper.includes(kw));
}

async function existsOrThrow(filePath: string): Promise<true> {
  await access(filePath);
  return true;
}

async function packageDeps(root: string): Promise<Set<string>> {
  try {
    const raw = await readFile(path.join(root, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    return new Set([
      ...Object.keys((pkg['dependencies'] as Record<string, string>) ?? {}),
      ...Object.keys((pkg['devDependencies'] as Record<string, string>) ?? {}),
    ]);
  } catch {
    return new Set();
  }
}

export async function detectFramework(root: string): Promise<FrameworkInfo> {
  const [hasNext, hasVite, deps] = await Promise.all([
    Promise.any([
      existsOrThrow(path.join(root, 'next.config.js')),
      existsOrThrow(path.join(root, 'next.config.mjs')),
      existsOrThrow(path.join(root, 'next.config.ts')),
    ]).catch(() => false),
    Promise.any([
      existsOrThrow(path.join(root, 'vite.config.js')),
      existsOrThrow(path.join(root, 'vite.config.ts')),
      existsOrThrow(path.join(root, 'vite.config.mjs')),
    ]).catch(() => false),
    packageDeps(root),
  ]);

  if (hasNext || deps.has('next')) {
    return { framework: 'nextjs', publicPrefix: 'NEXT_PUBLIC_', label: 'Next.js' };
  }
  if (hasVite || deps.has('vite')) {
    return { framework: 'vite', publicPrefix: 'VITE_', label: 'Vite' };
  }
  if (deps.has('react-scripts')) {
    return { framework: 'cra', publicPrefix: 'REACT_APP_', label: 'Create React App' };
  }
  return { framework: 'none', publicPrefix: null, label: null };
}
