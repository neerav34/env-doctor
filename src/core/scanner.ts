import { open } from 'fs/promises';
import path from 'path';
import { findSourceFiles, type FindFilesOptions } from '../utils/glob.js';

export interface ScannerResult {
  files: string[];
  skippedFiles: number;
}

/**
 * Discovers all text-based source files in the project root, excluding
 * binary files and configured ignore patterns.
 */
export async function scanProjectFiles(
  root: string,
  options: FindFilesOptions = {}
): Promise<ScannerResult> {
  const allFiles = await findSourceFiles(root, options);

  // Parallel binary detection — read first 1KB to check for null bytes
  const results = await Promise.allSettled(
    allFiles.map(file => isTextFile(path.join(root, file)).then(isText => (isText ? file : null)))
  );

  const textFiles: string[] = [];
  let skippedFiles = 0;

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      textFiles.push(result.value);
    } else {
      skippedFiles++;
    }
  }

  return { files: textFiles, skippedFiles };
}

async function isTextFile(fullPath: string): Promise<boolean> {
  let fd: Awaited<ReturnType<typeof open>> | null = null;
  try {
    fd = await open(fullPath, 'r');
    const buffer = Buffer.alloc(1024);
    const { bytesRead } = await fd.read(buffer, 0, 1024, 0);
    // Null bytes indicate binary content
    return !buffer.subarray(0, bytesRead).includes(0);
  } catch {
    return false;
  } finally {
    await fd?.close().catch(() => undefined);
  }
}
