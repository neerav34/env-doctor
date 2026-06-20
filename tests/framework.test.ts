import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';
import { detectFramework, looksLikeSecret } from '../src/utils/framework.js';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'env-doctor-fw-'));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('looksLikeSecret', () => {
  it('flags vars containing SECRET', () => {
    expect(looksLikeSecret('NEXT_PUBLIC_STRIPE_SECRET')).toBe(true);
  });

  it('flags vars containing KEY', () => {
    expect(looksLikeSecret('VITE_API_KEY')).toBe(true);
  });

  it('flags vars containing TOKEN', () => {
    expect(looksLikeSecret('NEXT_PUBLIC_AUTH_TOKEN')).toBe(true);
  });

  it('flags vars containing PASSWORD', () => {
    expect(looksLikeSecret('NEXT_PUBLIC_DB_PASSWORD')).toBe(true);
  });

  it('does not flag safe public vars', () => {
    expect(looksLikeSecret('NEXT_PUBLIC_API_URL')).toBe(false);
    expect(looksLikeSecret('VITE_APP_NAME')).toBe(false);
  });
});

describe('detectFramework', () => {
  it('returns none when no framework detected', async () => {
    const result = await detectFramework(tmpDir);
    expect(result.framework).toBe('none');
    expect(result.publicPrefix).toBeNull();
  });

  it('detects Next.js via next.config.js', async () => {
    const dir = path.join(tmpDir, 'next-project');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'next.config.js'), 'module.exports = {}');
    const result = await detectFramework(dir);
    expect(result.framework).toBe('nextjs');
    expect(result.publicPrefix).toBe('NEXT_PUBLIC_');
    expect(result.label).toBe('Next.js');
  });

  it('detects Vite via vite.config.ts', async () => {
    const dir = path.join(tmpDir, 'vite-project');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'vite.config.ts'), 'export default {}');
    const result = await detectFramework(dir);
    expect(result.framework).toBe('vite');
    expect(result.publicPrefix).toBe('VITE_');
    expect(result.label).toBe('Vite');
  });

  it('detects Next.js via package.json dependency', async () => {
    const dir = path.join(tmpDir, 'next-pkg');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { next: '14.0.0' } }));
    const result = await detectFramework(dir);
    expect(result.framework).toBe('nextjs');
  });

  it('detects CRA via react-scripts in package.json', async () => {
    const dir = path.join(tmpDir, 'cra-project');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { 'react-scripts': '5.0.0' } }));
    const result = await detectFramework(dir);
    expect(result.framework).toBe('cra');
    expect(result.publicPrefix).toBe('REACT_APP_');
  });
});
