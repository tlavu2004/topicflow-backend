import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureSwagger } from './common/http/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const environment = app.get(ConfigService);

  if (environment.getOrThrow<string>('NODE_ENV') !== 'production') {
    configureSwagger(app);
  }

  await app.listen(environment.getOrThrow<number>('PORT'), '0.0.0.0');
}
void bootstrap();
