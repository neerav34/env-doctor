import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import { loadConfig, mergeConfig } from '../src/utils/config.js';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'env-doctor-cfg-'));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('loadConfig', () => {
  it('returns empty object when no config file exists', async () => {
    const cfg = await loadConfig(tmpDir);
    expect(cfg).toEqual({});
  });

  it('loads .env-doctor.json', async () => {
    await writeFile(
      path.join(tmpDir, '.env-doctor.json'),
      JSON.stringify({ strict: true, envFile: '.env.local' })
    );
    const cfg = await loadConfig(tmpDir);
    expect(cfg.strict).toBe(true);
    expect(cfg.envFile).toBe('.env.local');
  });

  it('loads ignore array', async () => {
    await writeFile(
      path.join(tmpDir, '.env-doctor.json'),
      JSON.stringify({ ignore: ['legacy/**', 'scripts/**'] })
    );
    const cfg = await loadConfig(tmpDir);
    expect(cfg.ignore).toEqual(['legacy/**', 'scripts/**']);
  });

  it('throws on invalid JSON', async () => {
    await writeFile(path.join(tmpDir, '.env-doctor.json'), '{ bad json }');
    await expect(loadConfig(tmpDir)).rejects.toThrow('Invalid JSON');
  });

  it('throws on wrong type for strict', async () => {
    await writeFile(path.join(tmpDir, '.env-doctor.json'), JSON.stringify({ strict: 'yes' }));
    await expect(loadConfig(tmpDir)).rejects.toThrow('strict must be a boolean');
  });

  it('throws on invalid format value', async () => {
    await writeFile(path.join(tmpDir, '.env-doctor.json'), JSON.stringify({ format: 'xml' }));
    await expect(loadConfig(tmpDir)).rejects.toThrow('format must be one of');
  });
});

describe('mergeConfig', () => {
  const defaults = { strict: false, envFile: '.env', ignore: ['node_modules'] };

  it('CLI values win over config when explicitly set', () => {
    const cli = { strict: true, envFile: '.env', ignore: ['node_modules'] };
    const cfg = { strict: false, envFile: '.env.production' };
    const result = mergeConfig(cli, cfg, defaults);
    expect(result.strict).toBe(true); // CLI set it
    expect(result.envFile).toBe('.env.production'); // config fills in default
  });

  it('config fills in values left at default', () => {
    const cli = { strict: false, envFile: '.env', ignore: ['node_modules'] };
    const cfg = { strict: true, envFile: '.env.staging' };
    const result = mergeConfig(cli, cfg, defaults);
    expect(result.strict).toBe(true);
    expect(result.envFile).toBe('.env.staging');
  });

  it('config does not override CLI non-default value', () => {
    const cli = { strict: false, envFile: '.env.local', ignore: ['node_modules'] };
    const cfg = { envFile: '.env.production' };
    const result = mergeConfig(cli, cfg, defaults);
    expect(result.envFile).toBe('.env.local'); // CLI explicitly set it
  });
});
