import { Injectable, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DatabaseModule } from './database.module';
import { PrismaService } from './prisma.service';

@Injectable()
class FirstRepository {
  constructor(readonly db: PrismaService) {}
}

@Injectable()
class SecondRepository {
  constructor(readonly db: PrismaService) {}
}

@Module({ imports: [DatabaseModule], providers: [FirstRepository] })
class FirstModule {}

@Module({ imports: [DatabaseModule], providers: [SecondRepository] })
class SecondModule {}

describe('DatabaseModule lifecycle', () => {
  it('shares one client across importing modules and disconnects once on close', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        FirstModule,
        SecondModule,
      ],
    }).compile();
    const first = module.get(FirstRepository).db;
    const second = module.get(SecondRepository).db;
    const disconnect = jest
      .spyOn(first, '$disconnect')
      .mockResolvedValue(undefined);
    try {
      expect(first).toBe(second);
    } finally {
      await module.close();
    }
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
