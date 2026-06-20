import { describe, it, expect } from 'vitest';
import { auditRawVars } from '../src/core/auditor.js';

// Construct test credential strings at runtime so static scanners don't flag them
const fake = {
  // sk_live_ + 24 alphanum chars
  stripeLive: ['sk', 'live', 'abcdefghijklmnopqrstuvwx'].join('_'),
  // sk_test_ + 24 alphanum chars
  stripeTest: ['sk', 'test', 'abcdefghijklmnopqrstuvwx'].join('_'),
  // AKIA + 16 uppercase alphanums
  awsKey: 'AKIA' + 'IOSFODNN7EXAMPLE',
  // ghp_ + 36 alphanums
  githubToken: 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789ab',
  // npm_ + 36 alphanums
  npmToken: 'npm_' + 'abcdefghijklmnopqrstuvwxyz0123456789ab',
  // postgresql:// with password
  dbUrl: 'postgresql://user:supersecret@localhost:5432/mydb',
};

function makeVars(entries: Record<string, string>) {
  return new Map(
    Object.entries(entries).map(([k, v]) => [k, { name: k, file: '.env', line: 1, value: v }])
  );
}

describe('auditRawVars', () => {
  it('returns empty when no credentials found', () => {
    const vars = makeVars({ PORT: '3000', NODE_ENV: 'development' });
    expect(auditRawVars(vars)).toHaveLength(0);
  });

  it('flags Stripe live secret key', () => {
    const vars = makeVars({ STRIPE_KEY: fake.stripeLive });
    const findings = auditRawVars(vars);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.credentialType).toBe('Stripe secret key');
    expect(findings[0]?.severity).toBe('error');
  });

  it('flags Stripe test key as error too', () => {
    const vars = makeVars({ STRIPE_KEY: fake.stripeTest });
    const findings = auditRawVars(vars);
    expect(findings[0]?.credentialType).toBe('Stripe secret key');
  });

  it('flags AWS access key ID', () => {
    const vars = makeVars({ AWS_KEY: fake.awsKey });
    const findings = auditRawVars(vars);
    expect(findings[0]?.credentialType).toBe('AWS access key ID');
    expect(findings[0]?.severity).toBe('error');
  });

  it('flags GitHub personal access token', () => {
    const vars = makeVars({ GH_TOKEN: fake.githubToken });
    const findings = auditRawVars(vars);
    expect(findings[0]?.credentialType).toBe('GitHub personal access token');
  });

  it('flags npm token', () => {
    const vars = makeVars({ NPM_TOKEN: fake.npmToken });
    const findings = auditRawVars(vars);
    expect(findings[0]?.credentialType).toBe('npm automation token');
  });

  it('flags database URL with password', () => {
    const vars = makeVars({ DB_URL: fake.dbUrl });
    const findings = auditRawVars(vars);
    expect(findings[0]?.credentialType).toBe('Database URL with password');
    expect(findings[0]?.severity).toBe('warn');
  });

  it('does not flag empty values', () => {
    const vars = makeVars({ STRIPE_KEY: '' });
    expect(auditRawVars(vars)).toHaveLength(0);
  });

  it('returns errors before warnings', () => {
    const vars = makeVars({
      DB_URL: fake.dbUrl,
      STRIPE_KEY: fake.stripeLive,
    });
    const findings = auditRawVars(vars);
    expect(findings[0]?.severity).toBe('error');
    expect(findings[1]?.severity).toBe('warn');
  });
});
