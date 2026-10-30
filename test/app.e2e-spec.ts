import { Test, TestingModule } from '@nestjs/testing';
import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { IsInt, Min } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureSwagger } from './../src/common/http/swagger';

class ProbeBody {
  @IsInt()
  @Min(1)
  count!: number;
}

@Controller('_smoke')
class SmokeController {
  @Post()
  accept(@Body() body: ProbeBody): ProbeBody {
    return body;
  }

  @Get('unexpected-error')
  fail(): never {
    throw new Error('internal-only-details');
  }
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [SmokeController],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureSwagger(app);
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('serves Swagger UI and OpenAPI JSON', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200);
    const response = await request(app.getHttpServer())
      .get('/docs/json')
      .expect(200);
    const document = response.body as { paths: Record<string, unknown> };
    expect(document.paths['/health']).toBeDefined();
  });

  it('returns Problem Details for invalid DTOs', async () => {
    const response = await request(app.getHttpServer())
      .post('/_smoke')
      .send({ count: 0, extra: true })
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      instance: '/_smoke',
    });
    const problem = response.body as { errors: string[] };
    expect(problem.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('count')]),
    );
  });

  it('hides unexpected error details', async () => {
    const response = await request(app.getHttpServer())
      .get('/_smoke/unexpected-error')
      .expect(500)
      .expect('Content-Type', /application\/problem\+json/);

    const problem = response.body as { detail: string };
    expect(problem.detail).toBe('An unexpected error occurred.');
    expect(JSON.stringify(response.body)).not.toContain(
      'internal-only-details',
    );
  });

  afterEach(async () => {
    await app.close();
  });
});
