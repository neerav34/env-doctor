import type { EnvVarReference, EnvVarDefinition, Issue } from '../types/index.js';

export interface AnalyzerInput {
  foundVars: Map<string, EnvVarReference[]>;
  envVars: Map<string, EnvVarDefinition>;
  exampleVars: Map<string, EnvVarDefinition>;
}

/**
 * Cross-references code references against .env and .env.example definitions
 * to produce a list of issues.
 */
export function analyze(input: AnalyzerInput): Issue[] {
  const { foundVars, envVars, exampleVars } = input;
  const issues: Issue[] = [];

  // Check each variable referenced in source code
  for (const [name, refs] of foundVars) {
    const inEnv = envVars.has(name);
    const inExample = exampleVars.has(name);

    if (!inEnv && !inExample) {
      // Not anywhere — hard error
      issues.push({
        severity: 'error',
        type: 'missing',
        variable: name,
        message: `${name} is referenced in ${refs.length} location(s) but not defined in .env or .env.example`,
        references: refs,
        suggestion: `Add ${name} to .env.example`,
      });
    } else if (!inEnv && inExample) {
      // Documented but not configured locally
      const def = exampleVars.get(name);
      issues.push({
        severity: 'warn',
        type: 'missing',
        variable: name,
        message: `${name} is referenced but missing from .env (documented in .env.example)`,
        references: refs,
        ...(def !== undefined ? { definition: def } : {}),
        suggestion: `Copy ${name} from .env.example to .env and set a real value`,
      });
    }
  }

  // Check each variable defined in .env
  for (const [name, def] of envVars) {
    if (!foundVars.has(name)) {
      issues.push({
        severity: 'warn',
        type: 'unused',
        variable: name,
        message: `${name} is defined in .env but never referenced in source code`,
        definition: def,
        suggestion: `Remove ${name} from .env, or check for typos in variable name`,
      });
    }

    if (!exampleVars.has(name)) {
      issues.push({
        severity: 'warn',
        type: 'example-drift',
        variable: name,
        message: `${name} exists in .env but is missing from .env.example`,
        definition: def,
        suggestion: `Run \`env-doctor check --fix\` to sync .env.example`,
      });
    }
  }

  // Check vars only in .env.example that have no corresponding code reference or .env entry
  for (const [name, def] of exampleVars) {
    if (!foundVars.has(name) && !envVars.has(name)) {
      issues.push({
        severity: 'warn',
        type: 'example-drift',
        variable: name,
        message: `${name} is in .env.example but not referenced in code or .env`,
        definition: def,
        suggestion: `Remove ${name} from .env.example if it is no longer needed`,
      });
    }
  }

  // Sort: errors first, then warns, then by variable name
  return issues.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'error' ? -1 : 1;
    }
    return a.variable.localeCompare(b.variable);
  });
}
