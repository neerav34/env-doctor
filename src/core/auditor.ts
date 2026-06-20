import type { EnvVarDefinition } from '../types/index.js';

export interface AuditFinding {
  variable: string;
  file: string;
  line: number;
  credentialType: string;
  severity: 'error' | 'warn';
  suggestion: string;
}

interface CredentialPattern {
  type: string;
  regex: RegExp;
  severity: 'error' | 'warn';
  suggestion: string;
}

const PATTERNS: CredentialPattern[] = [
  {
    type: 'Stripe secret key',
    regex: /^sk_(live|test)_[a-zA-Z0-9]{20,}/,
    severity: 'error',
    suggestion: 'Rotate this key immediately at dashboard.stripe.com',
  },
  {
    type: 'Stripe publishable key',
    regex: /^pk_(live|test)_[a-zA-Z0-9]{20,}/,
    severity: 'warn',
    suggestion: 'Publishable keys are safe to expose, but avoid committing to git',
  },
  {
    type: 'AWS access key ID',
    regex: /^AKIA[0-9A-Z]{16}$/,
    severity: 'error',
    suggestion: 'Rotate this key immediately in AWS IAM console',
  },
  {
    type: 'GitHub personal access token',
    regex: /^gh[pousr]_[a-zA-Z0-9]{36,}/,
    severity: 'error',
    suggestion: 'Revoke this token at github.com/settings/tokens',
  },
  {
    type: 'npm automation token',
    regex: /^npm_[a-zA-Z0-9]{36,}/,
    severity: 'error',
    suggestion: 'Revoke this token at npmjs.com/settings/tokens',
  },
  {
    type: 'Slack token',
    regex: /^xox[baprs]-[a-zA-Z0-9-]{10,}/,
    severity: 'error',
    suggestion: 'Revoke this token at api.slack.com/apps',
  },
  {
    type: 'JSON Web Token (JWT)',
    regex: /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,
    severity: 'warn',
    suggestion: 'Avoid hardcoding JWTs — use short-lived tokens at runtime',
  },
  {
    type: 'Private key (PEM)',
    regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    severity: 'error',
    suggestion: 'Never store private keys in .env files — use a secrets manager',
  },
  {
    type: 'Database URL with password',
    regex: /^(postgres|postgresql|mysql|mongodb|redis):\/\/[^:]+:[^@]{4,}@/,
    severity: 'warn',
    suggestion: 'Ensure this .env file is in .gitignore and never committed',
  },
  {
    type: 'SendGrid API key',
    regex: /^SG\.[a-zA-Z0-9_-]{22,}\.[a-zA-Z0-9_-]{43,}/,
    severity: 'error',
    suggestion: 'Revoke this key at app.sendgrid.com/settings/api_keys',
  },
];

export function auditEnvVars(vars: Map<string, EnvVarDefinition>): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const [name, def] of vars) {
    if (!def.value) continue;

    // def.value is already truncated (first 3 chars + ***) — we need raw value
    // auditor receives the full value via a separate map, see runAudit below
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(def.value)) {
        findings.push({
          variable: name,
          file: def.file,
          line: def.line,
          credentialType: pattern.type,
          severity: pattern.severity,
          suggestion: pattern.suggestion,
        });
        break; // one finding per variable
      }
    }
  }

  return findings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
    return a.variable.localeCompare(b.variable);
  });
}

export function auditRawVars(rawVars: Map<string, { name: string; file: string; line: number; value: string }>): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const [name, def] of rawVars) {
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(def.value)) {
        findings.push({
          variable: name,
          file: def.file,
          line: def.line,
          credentialType: pattern.type,
          severity: pattern.severity,
          suggestion: pattern.suggestion,
        });
        break;
      }
    }
  }

  return findings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
    return a.variable.localeCompare(b.variable);
  });
}
