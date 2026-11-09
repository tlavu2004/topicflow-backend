import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Shared connection lifecycle; repositories retain ownership of domain writes. */
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class DatabaseModule {}
