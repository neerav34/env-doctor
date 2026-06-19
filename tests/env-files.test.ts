import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import { discoverEnvFiles } from '../src/utils/env-files.js';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'env-doctor-test-'));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('discoverEnvFiles', () => {
  it('returns empty array when no env files exist', async () => {
    const found = await discoverEnvFiles(tmpDir);
    expect(found).toEqual([]);
  });

  it('discovers .env when present', async () => {
    await writeFile(path.join(tmpDir, '.env'), 'FOO=bar');
    const found = await discoverEnvFiles(tmpDir);
    expect(found).toContain('.env');
  });

  it('discovers .env.local alongside .env', async () => {
    await writeFile(path.join(tmpDir, '.env.local'), 'LOCAL_VAR=1');
    const found = await discoverEnvFiles(tmpDir);
    expect(found).toContain('.env');
    expect(found).toContain('.env.local');
  });

  it('discovers .env.production when present', async () => {
    await writeFile(path.join(tmpDir, '.env.production'), 'DB_URL=prod');
    const found = await discoverEnvFiles(tmpDir);
    expect(found).toContain('.env.production');
  });

  it('returns files in priority order (.env before .env.local)', async () => {
    const found = await discoverEnvFiles(tmpDir);
    const envIdx = found.indexOf('.env');
    const localIdx = found.indexOf('.env.local');
    expect(envIdx).toBeLessThan(localIdx);
  });

  it('does not include non-existent variants', async () => {
    const found = await discoverEnvFiles(tmpDir);
    expect(found).not.toContain('.env.staging');
    expect(found).not.toContain('.env.test');
  });
});
