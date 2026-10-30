export type AppEnvironment = 'development' | 'test' | 'production';

export interface EnvironmentConfig {
  NODE_ENV: AppEnvironment;
  PORT: number;
  DATABASE_URL: string;
}

export function validateEnvironment(
  values: Record<string, unknown>,
): Record<string, unknown> & EnvironmentConfig {
  const nodeEnv = values.NODE_ENV ?? 'development';
  if (
    typeof nodeEnv !== 'string' ||
    !['development', 'test', 'production'].includes(nodeEnv)
  ) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const port = Number(values.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const databaseUrl = values.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required');
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (
    !['postgresql:', 'postgres:'].includes(parsedUrl.protocol) ||
    !parsedUrl.hostname ||
    !parsedUrl.pathname ||
    parsedUrl.pathname === '/'
  ) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }

  return {
    ...values,
    NODE_ENV: nodeEnv as AppEnvironment,
    PORT: port,
    DATABASE_URL: databaseUrl,
  };
}
