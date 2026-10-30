import { validateEnvironment } from './environment';

const validUrl = 'postgresql://user:password@localhost:5432/topicflow';

describe('validateEnvironment', () => {
  it('normalizes local defaults', () => {
    expect(validateEnvironment({ DATABASE_URL: validUrl })).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: validUrl,
    });
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
