import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { parseDecimalBigInt } from '../../common/http/decimal-bigint';
import { IdentityAccessService } from './identity-access.service';

export function bearerToken(header: string | undefined): string {
  const match = /^Bearer ([^\s]+)$/i.exec(header ?? '');
  if (!match) throw new UnauthorizedException('Bearer token required');
  return match[1];
}

export type AuthenticatedRequest = Request & { userId: bigint };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly identity: IdentityAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = await this.identity.authenticateAccessToken(
      bearerToken(request.headers.authorization),
    );
    request.userId = parseDecimalBigInt(principal.userId);
    return true;
  }
}
