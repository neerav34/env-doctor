# env-doctor

> The eslint of environment variables — catch missing env vars before they hit production.

**[env-doctor-web.vercel.app](https://env-doctor-web.vercel.app)** · [npm](https://www.npmjs.com/package/@neerav34/env-doctor) · [GitHub Action](https://github.com/marketplace/actions/env-doctor) · [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=neeravjha.env-doctor)

[![npm version](https://img.shields.io/npm/v/@neerav34/env-doctor)](https://www.npmjs.com/package/@neerav34/env-doctor)
[![CI](https://github.com/neerav34/env-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/neerav34/env-doctor/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem

Developers lose hours debugging "works on my machine" failures caused by missing, misconfigured, or undocumented environment variables. `env-doctor` gives you a fast, zero-config CLI that scans your codebase, detects all env var references, and cross-checks them against your `.env` and `.env.example` files.

## VS Code Extension

Get inline squiggles directly in your editor — no terminal needed. Install **[env-doctor](https://marketplace.visualstudio.com/items?itemName=neeravjha.env-doctor)** from the VS Code Marketplace.

## Features

- **Zero config** — works out of the box on Node.js, Python, Go, Rust, Ruby, PHP, and Shell projects
- **Multi-language detection** — `process.env`, `os.environ`, `os.Getenv`, `env::var`, `ENV[]`, and more
- **CI-ready** — meaningful exit codes (0 = clean, 1 = errors, 2 = warnings, 3 = fatal)
- **Three output formats** — pretty terminal output, JSON for tooling, Markdown for PR comments
- **Auto-fix** — `--fix` updates `.env.example` automatically
- **Health scoring** — `doctor` command gives a 0–100 score with trend tracking

## Installation

```bash
npm install -g @neerav34/env-doctor
# or use without installing
npx @neerav34/env-doctor check
```

## Quick Start

```bash
# Check for discrepancies
env-doctor check

# Generate / update .env.example from your code
env-doctor init

# Full diagnostic with health score
env-doctor doctor
```

## Commands

### `env-doctor check`

Scans your codebase and reports all environment variable discrepancies.

```bash
env-doctor check [options]

Options:
  --fix                    Auto-update .env.example to match code references
  --strict                 Treat warnings as errors (exit 1)
  --env-file <path>        Path to .env file (default: .env)
  --example-file <path>    Path to .env.example file (default: .env.example)
  --ignore <patterns...>   Additional glob patterns to skip
  --format <fmt>           Output format: pretty | json | markdown (default: pretty)
  --no-color               Disable ANSI color output
  --root <path>            Project root directory (default: cwd)
```

**Exit codes:**
| Code | Meaning |
|------|---------|
| `0`  | All clear |
| `1`  | ERROR-level issues found (or `--strict` with warnings) |
| `2`  | Only WARN-level issues |
| `3`  | Fatal error (crash, bad arguments) |

### `env-doctor init`

Generates or updates `.env.example` from all env var references found in your code.

```bash
env-doctor init [options]

Options:
  --env-file <path>        Source .env file (default: .env)
  --example-file <path>    Target file (default: .env.example)
  --with-comments          Add source file comments to each variable
  --ignore <patterns...>   Additional glob patterns to skip
  --no-color               Disable ANSI color output
  --root <path>            Project root directory
```

### `env-doctor doctor`

Full diagnostic with a health score (0–100) and trend analysis vs. previous scans.

```bash
env-doctor doctor [options]
```

Same flags as `check`. Stores scan history in `.env-doctor/cache.json`.

## What It Detects

| Check | Severity | Description |
|-------|----------|-------------|
| Missing Required | **ERROR** | Var referenced in code but absent from both `.env` and `.env.example` |
| Missing Optional | WARN | Var referenced in code and in `.env.example` but not in `.env` |
| Unused Variable | WARN | Var defined in `.env` but never referenced in code |
| Example Drift | WARN | Var in `.env` but not in `.env.example` (or vice versa) |

## Supported Languages

| Language | Detected Patterns |
|----------|------------------|
| JavaScript / TypeScript | `process.env.VAR`, `process.env['VAR']`, `import.meta.env.VAR` |
| Python | `os.environ['VAR']`, `os.environ.get('VAR')`, `os.getenv('VAR')` |
| Go | `os.Getenv("VAR")` |
| Rust | `env::var("VAR")` |
| Ruby | `ENV['VAR']` |
| PHP | `$_ENV['VAR']`, `getenv('VAR')` |
| Shell / Docker | `${VAR}` in `.sh`, `Dockerfile`, `docker-compose.yml` |

## CI Integration

### GitHub Actions

```yaml
- name: Check environment variables
  run: npx env-doctor check --strict --format markdown >> $GITHUB_STEP_SUMMARY
```

### GitLab CI

```yaml
env-check:
  script:
    - npx env-doctor check --strict
```

## Output Examples

### Pretty (default)

```
  ERRORS (1)

  ✗  DATABASE_URL  [Missing Required]
     DATABASE_URL is referenced in 2 location(s) but not defined in .env or .env.example
     └─ src/db.ts:14  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
     → Add DATABASE_URL to .env.example

  WARNINGS (2)

  ⚠  OLD_API_KEY  [Unused Variable]
     OLD_API_KEY is defined in .env but never referenced in source code
     → Remove OLD_API_KEY from .env or check for typos in variable name

  Scanned 142 files in 45ms
```

### JSON (`--format json`)

```json
{
  "success": false,
  "summary": { "errors": 1, "warnings": 2, "scannedFiles": 142, "duration": 45 },
  "issues": [...]
}
```

## Development

```bash
git clone https://github.com/your-username/env-doctor.git
cd env-doctor
npm install
npm run dev -- check          # run in dev mode
npm test                      # run tests
npm run build                 # build to dist/
npm run dogfood               # run against itself
```

## License

MIT © [Neerav Jha](https://github.com/neerav34)
