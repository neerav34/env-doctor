import { access } from 'fs/promises';
import path from 'path';

const COMMON_ENV_FILES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.test',
  '.env.test.local',
  '.env.staging',
  '.env.staging.local',
  '.env.production',
  '.env.production.local',
];

export async function discoverEnvFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  for (const file of COMMON_ENV_FILES) {
    try {
      await access(path.join(root, file));
      found.push(file);
    } catch {
      // file doesn't exist
    }
  }
  return found;
}
