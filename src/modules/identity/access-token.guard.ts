import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { parseDecimalBigInt } from '../../common/http/decimal-bigint';
import { AuthService } from './auth.service';

export function bearerToken(header: string | undefined): string {
  const match = /^Bearer ([^\s]+)$/i.exec(header ?? '');
  if (!match) throw new UnauthorizedException('Bearer token required');
  return match[1];
}

export type AuthenticatedRequest = Request & { userId: bigint };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const claims = await this.auth.verify(
      bearerToken(request.headers.authorization),
      'access',
    );
    request.userId = parseDecimalBigInt(claims.sub);
    return true;
  }
}
