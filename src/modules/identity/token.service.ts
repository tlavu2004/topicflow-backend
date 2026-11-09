import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import {
  parseDecimalBigInt,
  serializeDecimalBigInt,
} from '../../common/http/decimal-bigint';
import type { TokenPair } from './auth.types';

export const JWT_ISSUER = 'topicflow';
export const JWT_AUDIENCE = 'topicflow-api';
const ACCESS_SECONDS = 900;
const REFRESH_SECONDS = 7 * 24 * 60 * 60;
interface TokenClaims {
  sub: string;
  type: 'access' | 'refresh';
  jti: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async verify(token: string, type: TokenClaims['type']): Promise<TokenClaims> {
    try {
      const claims = await this.jwt.verifyAsync<TokenClaims>(token, {
        secret: this.config.getOrThrow<string>(
          type === 'access' ? 'JWT_ACCESS_SECRET' : 'JWT_REFRESH_SECRET',
        ),
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      if (
        claims.type !== type ||
        typeof claims.sub !== 'string' ||
        typeof claims.jti !== 'string'
      )
        throw new Error('Invalid claims');
      parseDecimalBigInt(claims.sub);
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          claims.jti,
        )
      )
        throw new Error('Invalid session');
      return claims;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  fingerprint(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issue(userId: bigint): Promise<{
    tokens: TokenPair;
    session: { id: string; userId: bigint; tokenHash: string; expiresAt: Date };
  }> {
    const id = randomUUID();
    const sub = serializeDecimalBigInt(userId);
    const sign = (type: TokenClaims['type'], expiresIn: number) =>
      this.jwt.signAsync(
        { sub, type, jti: type === 'refresh' ? id : randomUUID() },
        {
          secret: this.config.getOrThrow<string>(
            type === 'access' ? 'JWT_ACCESS_SECRET' : 'JWT_REFRESH_SECRET',
          ),
          algorithm: 'HS256',
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          expiresIn,
        },
      );
    const [accessToken, refreshToken] = await Promise.all([
      sign('access', ACCESS_SECONDS),
      sign('refresh', REFRESH_SECONDS),
    ]);
    return {
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_SECONDS,
      },
      session: {
        id,
        userId,
        tokenHash: this.fingerprint(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000),
      },
    };
  }
}
