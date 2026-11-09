process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET = 'test-only-access-secret-at-least-32-bytes';
process.env.JWT_REFRESH_SECRET = 'test-only-refresh-secret-at-least-32-bytes';
