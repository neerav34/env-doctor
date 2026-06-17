import { describe, it, expect } from 'vitest';
import { parseEnvContent } from '../src/core/parser.js';

describe('parseEnvContent', () => {
  it('parses simple KEY=VALUE pairs', () => {
    const vars = parseEnvContent('DATABASE_URL=postgres://localhost\nPORT=3000\n', '.env', false);
    expect(vars.size).toBe(2);
    expect(vars.has('DATABASE_URL')).toBe(true);
    expect(vars.has('PORT')).toBe(true);
  });

  it('skips comment lines starting with #', () => {
    const vars = parseEnvContent('# This is a comment\nKEY=value\n', '.env', false);
    expect(vars.size).toBe(1);
    expect(vars.has('KEY')).toBe(true);
  });

  it('skips comment lines starting with //', () => {
    const vars = parseEnvContent('// comment\nKEY=value\n', '.env', false);
    expect(vars.size).toBe(1);
  });

  it('skips empty lines', () => {
    const vars = parseEnvContent('\n\nKEY=value\n\n', '.env', false);
    expect(vars.size).toBe(1);
  });

  it('strips export prefix', () => {
    const vars = parseEnvContent('export API_KEY=abc123\n', '.env', false);
    expect(vars.has('API_KEY')).toBe(true);
  });

  it('strips double-quoted values', () => {
    const vars = parseEnvContent('KEY="hello world"\n', '.env', false);
    expect(vars.has('KEY')).toBe(true);
  });

  it('strips single-quoted values', () => {
    const vars = parseEnvContent("KEY='hello world'\n", '.env', false);
    expect(vars.has('KEY')).toBe(true);
  });

  it('handles empty value', () => {
    const vars = parseEnvContent('KEY=\n', '.env', false);
    expect(vars.has('KEY')).toBe(true);
    expect(vars.get('KEY')?.value).toBeUndefined();
  });

  it('strips inline comments', () => {
    const vars = parseEnvContent('KEY=value # this is inline\n', '.env', false);
    expect(vars.has('KEY')).toBe(true);
  });

  it('handles KEY= # comment pattern (empty value)', () => {
    const vars = parseEnvContent('KEY= # comment\n', '.env', false);
    expect(vars.has('KEY')).toBe(true);
  });

  it('truncates value display to 3 chars + ***', () => {
    const vars = parseEnvContent('KEY=supersecret\n', '.env', false);
    expect(vars.get('KEY')?.value).toBe('sup***');
  });

  it('marks isExample correctly', () => {
    const vars = parseEnvContent('KEY=value\n', '.env.example', true);
    expect(vars.get('KEY')?.isExample).toBe(true);
  });

  it('records correct line number', () => {
    const vars = parseEnvContent('# comment\nKEY=value\n', '.env', false);
    expect(vars.get('KEY')?.line).toBe(2);
  });

  it('ignores invalid key names', () => {
    const vars = parseEnvContent('123INVALID=value\n-BAD=value\nGOOD=value\n', '.env', false);
    expect(vars.has('GOOD')).toBe(true);
    expect(vars.size).toBe(1);
  });

  it('handles lines without = sign gracefully', () => {
    const vars = parseEnvContent('MALFORMED\nGOOD=value\n', '.env', false);
    expect(vars.size).toBe(1);
    expect(vars.has('GOOD')).toBe(true);
  });
});
