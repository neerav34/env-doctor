import { readFile } from 'fs/promises';
import type { EnvVarDefinition } from '../types/index.js';

export interface RawEnvVar {
  name: string;
  file: string;
  line: number;
  value: string;
}

export async function parseEnvFileRaw(filePath: string): Promise<Map<string, RawEnvVar>> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return new Map();
  }

  const vars = new Map<string, RawEnvVar>();
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    let line = (lines[i] ?? '').trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trim();

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let rawValue = line.slice(eqIndex + 1);
    if (
      (rawValue.startsWith('"') && !rawValue.slice(1).includes('"')) ||
      (rawValue.startsWith("'") && !rawValue.slice(1).includes("'"))
    ) {
      const quote = rawValue[0] as string;
      let combined = rawValue;
      while (i + 1 < lines.length) {
        i++;
        const nextLine = lines[i] ?? '';
        combined += '\n' + nextLine;
        if (nextLine.includes(quote)) break;
      }
      rawValue = combined;
    }

    const value = extractRawValue(rawValue);
    vars.set(key, { name: key, file: filePath, line: i + 1, value });
  }

  return vars;
}

function extractRawValue(raw: string): string {
  let value = raw.trim();
  const firstChar = value[0];
  if (firstChar !== '"' && firstChar !== "'") {
    const commentIdx = value.search(/\s+#/);
    if (commentIdx !== -1) value = value.slice(0, commentIdx).trim();
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

export interface ParseResult {
  vars: Map<string, EnvVarDefinition>;
  exists: boolean;
}

/**
 * Parses a .env or .env.example file and returns a map of variable definitions.
 * Handles: quoted values, export prefix, inline comments, empty values, multiline strings.
 */
export async function parseEnvFile(
  filePath: string,
  isExample: boolean
): Promise<ParseResult> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return { vars: new Map(), exists: false };
  }

  return { vars: parseEnvContent(content, filePath, isExample), exists: true };
}

export function parseEnvContent(
  content: string,
  filePath: string,
  isExample: boolean
): Map<string, EnvVarDefinition> {
  const vars = new Map<string, EnvVarDefinition>();
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    let line = rawLine.trim();

    // Skip empty lines and comment-only lines
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // Strip shell export prefix
    if (line.startsWith('export ')) {
      line = line.slice(7).trim();
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();

    // Validate key format — must be a valid env var name
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let rawValue = line.slice(eqIndex + 1);

    // Handle multiline values (KEY="line1\nline2")
    // Check for unclosed quote and peek ahead
    if (
      (rawValue.startsWith('"') && !rawValue.slice(1).includes('"')) ||
      (rawValue.startsWith("'") && !rawValue.slice(1).includes("'"))
    ) {
      const quote = rawValue[0] as string;
      let combined = rawValue;
      while (i + 1 < lines.length) {
        i++;
        const nextLine = lines[i] ?? '';
        combined += '\n' + nextLine;
        if (nextLine.includes(quote)) break;
      }
      rawValue = combined;
    }

    const value = extractValue(rawValue);

    // Display value: show first 3 chars then *** to avoid leaking secrets
    const displayValue = truncateValue(value);

    vars.set(key, {
      name: key,
      file: filePath,
      line: i + 1,
      ...(displayValue !== undefined ? { value: displayValue } : {}),
      isExample,
    });
  }

  return vars;
}

function extractValue(raw: string): string {
  let value = raw.trim();

  // Strip inline comment (KEY=value # comment) — only outside quotes
  const firstChar = value[0];
  if (firstChar !== '"' && firstChar !== "'") {
    const commentIdx = value.search(/\s+#/);
    if (commentIdx !== -1) {
      value = value.slice(0, commentIdx).trim();
    }
  }

  // Strip surrounding quotes
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value;
}

function truncateValue(value: string): string | undefined {
  if (!value) return undefined;
  if (value.length <= 3) return '***';
  return value.slice(0, 3) + '***';
}
