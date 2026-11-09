import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { IdentityRepository } from './identity.repository';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccessTokenGuard } from './access-token.guard';
import { LoginLimitGuard } from './login-limit.guard';
import { IdentityAccessService } from './identity-access.service';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    IdentityRepository,
    AuthService,
    IdentityAccessService,
    AccessTokenGuard,
    LoginLimitGuard,
  ],
  exports: [AccessTokenGuard, IdentityAccessService],
})
export class IdentityModule {}
