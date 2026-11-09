import { validateEnvironment } from './environment';

const validUrl = 'postgresql://user:password@localhost:5432/topicflow';
const secrets = {
  JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-bytes',
  JWT_REFRESH_SECRET: 'test-refresh-secret-with-at-least-32-bytes',
};

describe('validateEnvironment', () => {
  it('normalizes local defaults', () => {
    expect(
      validateEnvironment({ DATABASE_URL: validUrl, ...secrets }),
    ).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: validUrl,
    });
  });

  it('requires distinct strong JWT secrets', () => {
    expect(() => validateEnvironment({ DATABASE_URL: validUrl })).toThrow(
      'JWT_ACCESS_SECRET',
    );
    expect(() =>
      validateEnvironment({
        DATABASE_URL: validUrl,
        ...secrets,
        JWT_REFRESH_SECRET: secrets.JWT_ACCESS_SECRET,
      }),
    ).toThrow('different');
    expect(() =>
      validateEnvironment({
        DATABASE_URL: validUrl,
        ...secrets,
        JWT_REFRESH_SECRET: 'short',
      }),
    ).toThrow('JWT_REFRESH_SECRET');
  });

  it.each([
    [{ DATABASE_URL: '' }, 'DATABASE_URL is required'],
    [{ DATABASE_URL: 'mysql://localhost/topicflow' }, 'PostgreSQL URL'],
    [{ DATABASE_URL: validUrl, PORT: '0' }, 'PORT'],
    [{ DATABASE_URL: validUrl, NODE_ENV: 'staging' }, 'NODE_ENV'],
  ])('rejects invalid configuration', (input, expectedMessage) => {
    expect(() => validateEnvironment(input)).toThrow(expectedMessage);
  });
});
