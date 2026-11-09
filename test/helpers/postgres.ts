import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';

export async function startPostgres() {
  const directory = path.resolve('test-results/integration');
  mkdirSync(directory, { recursive: true });
  const logFile = path.join(directory, 'postgres.log');
  writeFileSync(logFile, 'Starting disposable PostgreSQL 17\n');
  const container = await new PostgreSqlContainer('postgres:17')
    .start()
    .catch((error: unknown) => {
      appendFileSync(
        logFile,
        'Container startup failed; inspect the CI test step\n',
      );
      throw error;
    });
  appendFileSync(
    logFile,
    'Container ready; applying committed Prisma migrations\n',
  );
  const url = container.getConnectionUri();
  try {
    execFileSync(
      process.execPath,
      [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      {
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'pipe',
        timeout: 60000,
      },
    );
    appendFileSync(logFile, 'Prisma migrations applied successfully\n');
    return { container, url };
  } catch (error) {
    appendFileSync(
      logFile,
      'Migration failed; stopping disposable container\n',
    );
    await container.stop();
    throw error;
  }
}
