import { describe, it, expect } from 'vitest';
import { analyze } from '../src/core/analyzer.js';
import type { EnvVarReference, EnvVarDefinition } from '../src/types/index.js';

function makeRef(name: string, file = 'src/app.ts', line = 1): EnvVarReference {
  return { name, file, line, column: 1, pattern: 'js', context: `process.env.${name}` };
}

function makeDef(name: string, file = '.env', isExample = false): EnvVarDefinition {
  return { name, file, line: 1, value: undefined, isExample };
}

describe('analyze', () => {
  it('returns no issues when everything is aligned', () => {
    const foundVars = new Map([['DATABASE_URL', [makeRef('DATABASE_URL')]]]);
    const envVars = new Map([['DATABASE_URL', makeDef('DATABASE_URL')]]);
    const exampleVars = new Map([['DATABASE_URL', makeDef('DATABASE_URL', '.env.example', true)]]);

    const issues = analyze({ foundVars, envVars, exampleVars });
    expect(issues).toHaveLength(0);
  });

  it('reports ERROR for var in code but missing from .env AND .env.example', () => {
    const foundVars = new Map([['MISSING_VAR', [makeRef('MISSING_VAR')]]]);
    const envVars = new Map<string, EnvVarDefinition>();
    const exampleVars = new Map<string, EnvVarDefinition>();

    const issues = analyze({ foundVars, envVars, exampleVars });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('error');
    expect(issues[0]?.type).toBe('missing');
    expect(issues[0]?.variable).toBe('MISSING_VAR');
  });

  it('reports WARN for var in code and .env.example but not .env', () => {
    const foundVars = new Map([['OPT_VAR', [makeRef('OPT_VAR')]]]);
    const envVars = new Map<string, EnvVarDefinition>();
    const exampleVars = new Map([['OPT_VAR', makeDef('OPT_VAR', '.env.example', true)]]);

    const issues = analyze({ foundVars, envVars, exampleVars });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warn');
    expect(issues[0]?.type).toBe('missing');
  });

  it('reports WARN for var in .env but never referenced in code', () => {
    const foundVars = new Map<string, EnvVarReference[]>();
    const envVars = new Map([['UNUSED_VAR', makeDef('UNUSED_VAR')]]);
    const exampleVars = new Map([['UNUSED_VAR', makeDef('UNUSED_VAR', '.env.example', true)]]);

    const issues = analyze({ foundVars, envVars, exampleVars });
    expect(issues.some(i => i.type === 'unused')).toBe(true);
  });

  it('reports WARN for example-drift (in .env but not .env.example)', () => {
    const foundVars = new Map([['MY_VAR', [makeRef('MY_VAR')]]]);
    const envVars = new Map([['MY_VAR', makeDef('MY_VAR')]]);
    const exampleVars = new Map<string, EnvVarDefinition>();

    const issues = analyze({ foundVars, envVars, exampleVars });
    expect(issues.some(i => i.type === 'example-drift')).toBe(true);
  });

  it('sorts errors before warnings', () => {
    const foundVars = new Map([
      ['WARN_VAR', [makeRef('WARN_VAR')]],
      ['ERROR_VAR', [makeRef('ERROR_VAR')]],
    ]);
    const envVars = new Map<string, EnvVarDefinition>();
    const exampleVars = new Map([['WARN_VAR', makeDef('WARN_VAR', '.env.example', true)]]);

    const issues = analyze({ foundVars, envVars, exampleVars });
    expect(issues[0]?.severity).toBe('error');
  });

  it('includes references in error issues', () => {
    const refs = [makeRef('BAD_VAR', 'src/a.ts', 5), makeRef('BAD_VAR', 'src/b.ts', 10)];
    const foundVars = new Map([['BAD_VAR', refs]]);
    const envVars = new Map<string, EnvVarDefinition>();
    const exampleVars = new Map<string, EnvVarDefinition>();

    const issues = analyze({ foundVars, envVars, exampleVars });
    expect(issues[0]?.references).toHaveLength(2);
  });

  it('includes suggestion in all issues', () => {
    const foundVars = new Map([['MISSING', [makeRef('MISSING')]]]);
    const envVars = new Map<string, EnvVarDefinition>();
    const exampleVars = new Map<string, EnvVarDefinition>();

    const issues = analyze({ foundVars, envVars, exampleVars });
    expect(issues[0]?.suggestion).toBeTruthy();
  });
});
