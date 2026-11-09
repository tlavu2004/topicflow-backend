import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEnvironment } from './load-environment';

describe('environment file selection', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'topicflow-env-'));
  });

  afterEach(() => {
    const target = path.resolve(root);
    if (!target.startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw new Error('Unexpected temporary directory');
    rmSync(target, { recursive: true, force: true });
  });

  it('loads local settings while preserving shell values, including empty values', () => {
    writeFileSync(
      path.join(root, '.env.local'),
      'NODE_ENV=development\nPORT=3000\nDATABASE_URL="local-url"\nJWT_ACCESS_SECRET=local-secret',
    );
    const env: NodeJS.ProcessEnv = { PORT: '4000', JWT_ACCESS_SECRET: '' };
    loadEnvironment(env, root);
    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: '4000',
      DATABASE_URL: 'local-url',
      JWT_ACCESS_SECRET: '',
    });
  });

  it.each([{ NODE_ENV: 'test' }, { NODE_ENV: 'production' }, { CI: 'true' }])(
    'never reads local files in %j',
    (settings) => {
      // This file would throw if read, proving the selection occurs first.
      writeFileSync(
        path.join(root, '.env.local'),
        'NODE_ENV=invalid\nDATABASE_URL=must-not-be-read',
      );
      const env: NodeJS.ProcessEnv = {
        ...settings,
        DATABASE_URL: 'injected-url',
      };
      loadEnvironment(env, root);
      expect(env.DATABASE_URL).toBe('injected-url');
      expect(env.NODE_ENV).toBe(settings.NODE_ENV ?? 'development');
    },
  );

  it('does not fall back to legacy or production env files', () => {
    writeFileSync(path.join(root, '.env'), 'DATABASE_URL=legacy-url');
    writeFileSync(
      path.join(root, '.env.production'),
      'DATABASE_URL=production-url',
    );
    const env: NodeJS.ProcessEnv = {};
    loadEnvironment(env, root);
    expect(env).toEqual({ NODE_ENV: 'development' });
  });

  it('supports environment-only development without a local file', () => {
    const env: NodeJS.ProcessEnv = { DATABASE_URL: 'shell-url' };
    loadEnvironment(env, root);
    expect(env.DATABASE_URL).toBe('shell-url');
  });

  it('requires test/production to be selected outside the local file', () => {
    writeFileSync(path.join(root, '.env.local'), 'NODE_ENV=production');
    expect(() => loadEnvironment({}, root)).toThrow(
      'select test/production externally',
    );
    expect(() => loadEnvironment({ NODE_ENV: 'local' }, root)).toThrow(
      'NODE_ENV',
    );
  });
});
