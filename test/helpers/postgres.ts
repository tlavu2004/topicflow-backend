import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export async function startPostgres() {
  const container = await new PostgreSqlContainer('postgres:17').start();
  const url = container.getConnectionUri();
  try {
    execFileSync(
      process.execPath,
      [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      {
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'pipe',
      },
    );
    return { container, url };
  } catch (error) {
    await container.stop();
    throw error;
  }
}
