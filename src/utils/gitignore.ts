import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Loads .gitignore patterns from the project root and converts them to
 * fast-glob compatible ignore patterns.
 */
export async function loadGitignorePatterns(root: string): Promise<string[]> {
  const gitignorePath = path.join(root, '.gitignore');
  try {
    const content = await readFile(gitignorePath, 'utf-8');
    return parseGitignorePatterns(content);
  } catch {
    return [];
  }
}

export function parseGitignorePatterns(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .flatMap(pattern => {
      // Negated patterns (!) are not supported in fast-glob ignore
      if (pattern.startsWith('!')) return [];

      // Directory-only pattern (ends with /)
      if (pattern.endsWith('/')) {
        const dir = pattern.slice(0, -1);
        return [`**/${dir}/**`, `${dir}/**`];
      }

      // Rooted pattern (starts with /)
      if (pattern.startsWith('/')) {
        return [pattern.slice(1), `${pattern.slice(1)}/**`];
      }

      // Pattern with directory separator in middle — keep as-is
      if (pattern.includes('/')) {
        return [pattern];
      }

      // Simple filename/glob — match anywhere
      return [`**/${pattern}`, `**/${pattern}/**`];
    });
}
