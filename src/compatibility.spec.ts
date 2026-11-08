import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

describe('Nest 11 compatibility', () => {
  it('creates an OpenAPI document and signs/verifies a JWT', async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule, JwtModule.register({ secret: 'test-only-secret' })],
    }).compile();
    const app = testingModule.createNestApplication();

    try {
      await app.init();
      const openApi = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      );
      expect(openApi.paths['/health']).toBeDefined();

      const jwt = testingModule.get(JwtService);
      const token = jwt.sign({ sub: '1' });
      expect(jwt.verify<{ sub: string }>(token).sub).toBe('1');
    } finally {
      await app.close();
    }
  });
});
