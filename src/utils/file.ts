import fs from 'node:fs';
import path from 'node:path';

/** Create a directory and every missing parent. Silent when it already exists. */
export const ensureDir = (dir: string): void => {
  fs.mkdirSync(dir, { recursive: true });
};

/** Read and parse a JSON file. Throws with the PATH attached, which `JSON.parse` does not. */
export function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `${filePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Read and parse a JSON file, or return `null` if it does not exist. */
export function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return readJson<T>(filePath);
}

/** Write JSON, creating the parent directory. Pretty by default — these files get read by humans. */
export function writeJson(filePath: string, data: unknown, pretty = true): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, pretty ? 2 : 0), 'utf8');
}

export const exists = (filePath: string): boolean => fs.existsSync(filePath);
