import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller';
import { ProblemDetailsFilter } from './common/http/problem-details.filter';
import { validateEnvironment } from './config/environment';
import { ArticleModule } from './modules/article';
import { CrawlerModule } from './modules/crawler';
import { IdentityModule } from './modules/identity';
import { MatchingModule } from './modules/matching';
import { SourceModule } from './modules/source';
import { TopicModule } from './modules/topic';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      validate: validateEnvironment,
    }),
    IdentityModule,
    SourceModule,
    TopicModule,
    CrawlerModule,
    ArticleModule,
    MatchingModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: false },
        }),
    },
  ],
})
export class AppModule {}
