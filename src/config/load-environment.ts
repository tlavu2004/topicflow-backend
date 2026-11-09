import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

/** Shared by Nest and Prisma CLI. Exported environment always takes priority. */
export function loadEnvironment(
  values: NodeJS.ProcessEnv = process.env,
  root = process.cwd(),
): void {
  const mode = values.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(mode)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  values.NODE_ENV = mode;
  if (mode !== 'development' || values.CI === 'true') return;

  let contents: string;
  try {
    contents = readFileSync(path.join(root, '.env.local'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  const local = parse(contents);
  if (local.NODE_ENV !== undefined && local.NODE_ENV !== 'development') {
    throw new Error(
      '.env.local NODE_ENV must be development; select test/production externally',
    );
  }
  for (const [key, value] of Object.entries(local)) {
    if (values[key] === undefined) values[key] = value;
  }
}
