import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { IdentityRepository } from './identity.repository';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccessTokenGuard } from './access-token.guard';
import { LoginLimitGuard } from './login-limit.guard';
import { IdentityAccessService } from './identity-access.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    PrismaService,
    IdentityRepository,
    AuthService,
    IdentityAccessService,
    AccessTokenGuard,
    LoginLimitGuard,
  ],
  exports: [AccessTokenGuard, IdentityAccessService],
})
export class IdentityModule {}
