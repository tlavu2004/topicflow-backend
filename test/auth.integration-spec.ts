import { Test } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  Module,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
} from '../src/modules/identity/token.service';
import { LoginLimitGuard } from '../src/modules/identity/login-limit.guard';
import { startPostgres } from './helpers/postgres';
import {
  AccessTokenGuard,
  IdentityAccessService,
  IdentityModule,
} from '../src/modules/identity';
import type { AuthenticatedRequest } from '../src/modules/identity';

// Consumer wiring uses only identity's public entry and exported providers.
@Controller('_consumer')
class ConsumerController {
  constructor(private readonly identity: IdentityAccessService) {}

  @Get()
  @UseGuards(AccessTokenGuard)
  principal(@Req() request: AuthenticatedRequest) {
    expect(this.identity).toBeInstanceOf(IdentityAccessService);
    return { userId: request.userId.toString() };
  }
}

@Module({ imports: [IdentityModule], controllers: [ConsumerController] })
class ConsumerModule {}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

describe('Identity with migrated PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof startPostgres>>;
  let app: INestApplication<App>;
  let db: PrismaService;
  const credentials = {
    email: 'reader@example.com',
    password: 'a-long-password-123',
  };

  beforeAll(async () => {
    database = await startPostgres();
    const module = await Test.createTestingModule({
      imports: [AppModule, ConsumerModule],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({ ...process.env, DATABASE_URL: database.url }),
      )
      .compile();
    app = module.createNestApplication();
    await app.init();
    db = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    await database?.container.stop();
  });

  const login = async (): Promise<Tokens> => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    return response.body as Tokens;
  };

  it('registers normalized email with Argon2id, rejects duplicates and invalid input', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...credentials, password: 'short' })
      .expect(400);
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...credentials, email: ' Reader@Example.com ' })
      .expect(201);
    expect(response.body).toEqual({
      id: expect.any(String) as unknown,
      email: credentials.email,
    });
    const user = await db.user.findUniqueOrThrow({
      where: { email: credentials.email },
    });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(user.passwordHash, credentials.password)).toBe(
      true,
    );
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(409);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ ...credentials, password: 'incorrect-password' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ ...credentials, email: 'missing@example.com' })
      .expect(401);
  });

  it('authenticates, rotates once under concurrency, and revokes on logout', async () => {
    const tokens = await login();
    await request(app.getHttpServer()).get('/me').expect(401);
    await request(app.getHttpServer())
      .get('/me')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/me')
      .auth(tokens.refreshToken, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .auth(tokens.accessToken, { type: 'bearer' })
      .expect(401);
    const results = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post('/auth/refresh')
          .auth(tokens.refreshToken, { type: 'bearer' }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    const rotated = results.find((r) => r.status === 200)!.body as Tokens;
    expect(rotated.refreshToken).not.toBe(tokens.refreshToken);
    const stored = await db.refreshSession.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored[0].tokenHash).not.toBe(rotated.refreshToken);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .auth(rotated.refreshToken, { type: 'bearer' })
      .expect(204);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .auth(rotated.refreshToken, { type: 'bearer' })
      .expect(401);
    // Access-token revocation is bounded by its 15-minute expiry.
    await request(app.getHttpServer())
      .get('/me')
      .auth(rotated.accessToken, { type: 'bearer' })
      .expect(200);
  });

  it('rejects expired, malformed, tampered tokens and preserves BIGINT subjects', async () => {
    const user = await db.user.create({
      data: {
        id: 9007199254740993n,
        email: 'large@example.com',
        passwordHash: 'unused',
      },
    });
    const jwt = new JwtService();
    const sign = (sub: string, expiresIn: number) =>
      jwt.sign(
        { sub, type: 'access', jti: randomUUID() },
        {
          secret: process.env.JWT_ACCESS_SECRET,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          expiresIn,
        },
      );
    const valid = sign(user.id.toString(), 900);
    await request(app.getHttpServer()).get('/_consumer').expect(401);
    const consumer = await request(app.getHttpServer())
      .get('/_consumer')
      .auth(valid, { type: 'bearer' })
      .expect(200);
    expect(consumer.body).toEqual({ userId: '9007199254740993' });
    const principal = await app
      .get(IdentityAccessService)
      .authenticateAccessToken(valid);
    expect(principal).toEqual({ userId: '9007199254740993' });
    const response = await request(app.getHttpServer())
      .get('/me')
      .auth(valid, { type: 'bearer' })
      .expect(200);
    expect(response.body).toEqual({
      id: '9007199254740993',
      email: user.email,
    });
    for (const token of [
      sign(user.id.toString(), -1),
      sign('9223372036854775808', 900),
      `${valid}tampered`,
      'invalid',
    ]) {
      await request(app.getHttpServer())
        .get('/me')
        .auth(token, { type: 'bearer' })
        .expect(401);
    }
    await db.user.delete({ where: { id: user.id } });
    await request(app.getHttpServer())
      .get('/me')
      .auth(valid, { type: 'bearer' })
      .expect(401);
  });

  it('limits authentication attempts per IP', async () => {
    // Advance beyond the shared limiter window used by previous requests.
    const limiter = app.get(LoginLimitGuard);
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);
    expect(limiter).toBeDefined();
    try {
      for (let i = 0; i < 10; i++)
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({})
          .expect(400);
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(429);
      expect(response.headers['retry-after']).toBeDefined();
    } finally {
      now.mockRestore();
    }
  });
});
