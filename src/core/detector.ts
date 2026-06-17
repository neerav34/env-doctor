import { readFile } from 'fs/promises';
import path from 'path';
import type { EnvVarReference } from '../types/index.js';

interface PatternDef {
  lang: string;
  source: string;
  /** If set, only apply this pattern to files with these extensions or basenames */
  extensions?: string[];
}

const PATTERN_DEFS: PatternDef[] = [
  // JavaScript / TypeScript — process.env.VAR (dot notation)
  {
    lang: 'js',
    source: String.raw`process\.env\.([A-Z_][A-Z0-9_]*)`,
  },
  // JavaScript / TypeScript — process.env['VAR'] or process.env["VAR"] (bracket notation)
  {
    lang: 'js',
    source: String.raw`process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]`,
  },
  // Vite / import.meta.env.VAR
  {
    lang: 'js',
    source: String.raw`import\.meta\.env\.([A-Z_][A-Z0-9_]*)`,
  },
  // Python — os.environ.get('VAR') and os.getenv('VAR') (function call)
  {
    lang: 'py',
    source: String.raw`os\.(?:environ\.get|getenv)\(\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*`,
    extensions: ['.py'],
  },
  // Python — os.environ['VAR'] (direct subscript)
  {
    lang: 'py',
    source: String.raw`os\.environ\[['"]([A-Z_][A-Z0-9_]*)['"]\]`,
    extensions: ['.py'],
  },
  // Go — os.Getenv("VAR")
  {
    lang: 'go',
    source: String.raw`os\.Getenv\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)`,
    extensions: ['.go'],
  },
  // Rust — env::var("VAR") or std::env::var("VAR")
  {
    lang: 'rs',
    source: String.raw`env::var\(\s*"([A-Z_][A-Z0-9_]*)"\s*\)`,
    extensions: ['.rs'],
  },
  // Ruby — ENV['VAR'] or ENV["VAR"]
  {
    lang: 'rb',
    source: String.raw`ENV\[['"]([A-Z_][A-Z0-9_]*)['"]\]`,
    extensions: ['.rb'],
  },
  // PHP — $_ENV['VAR'] or $_ENV["VAR"] (array subscript)
  {
    lang: 'php',
    source: String.raw`\$_ENV\[['"]([A-Z_][A-Z0-9_]*)['"]\]`,
    extensions: ['.php'],
  },
  // PHP — getenv('VAR') (function call)
  {
    lang: 'php',
    source: String.raw`getenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\)`,
    extensions: ['.php'],
  },
  // Docker Compose / Shell — ${VAR} syntax (restrict to avoid false positives)
  {
    lang: 'sh',
    source: String.raw`\$\{([A-Z_][A-Z0-9_]*)\}`,
    extensions: [
      '.sh', '.bash', '.zsh', '.fish',
      'Dockerfile', '.dockerfile',
      'docker-compose.yml', 'docker-compose.yaml',
      '.env.example',
    ],
  },
  // Shell — $VAR syntax (only in shell scripts)
  {
    lang: 'sh',
    source: String.raw`(?<![A-Za-z0-9_])\$([A-Z_][A-Z0-9_]*)(?![A-Za-z0-9_({])`,
    extensions: ['.sh', '.bash', '.zsh'],
  },
];

function getLineColumn(content: string, index: number): { line: number; column: number } {
  const before = content.slice(0, index);
  const lines = before.split('\n');
  const lastLine = lines[lines.length - 1] ?? '';
  return {
    line: lines.length,
    column: lastLine.length + 1,
  };
}

function isCommentedLine(line: string): boolean {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('--') ||
    trimmed.startsWith('<!--')
  );
}

function fileMatchesPattern(filePath: string, extensions: string[]): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath);
  return extensions.some(e => ext === e || basename === e || basename.endsWith(e));
}

export function detectVarsInContent(content: string, filePath: string): EnvVarReference[] {
  const lines = content.split('\n');
  const seen = new Set<string>();
  const refs: EnvVarReference[] = [];

  for (const def of PATTERN_DEFS) {
    if (def.extensions && !fileMatchesPattern(filePath, def.extensions)) continue;

    // Create a fresh RegExp per call to avoid lastIndex state issues with /g
    const regex = new RegExp(def.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const varName = match[1];
      if (!varName) continue;

      const pos = getLineColumn(content, match.index);
      const lineContent = lines[pos.line - 1] ?? '';

      if (isCommentedLine(lineContent)) continue;

      // Deduplicate by variable + location
      const key = `${varName}:${pos.line}:${pos.column}`;
      if (seen.has(key)) continue;
      seen.add(key);

      refs.push({
        name: varName,
        file: filePath,
        line: pos.line,
        column: pos.column,
        pattern: def.lang,
        context: lineContent.trim(),
      });
    }
  }

  return refs;
}

export async function detectVarsInFile(
  root: string,
  relativePath: string
): Promise<EnvVarReference[]> {
  const fullPath = path.join(root, relativePath);
  const content = await readFile(fullPath, 'utf-8');
  return detectVarsInContent(content, relativePath);
}
