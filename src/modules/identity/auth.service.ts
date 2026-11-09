import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import {
  parseDecimalBigInt,
  serializeDecimalBigInt,
} from '../../common/http/decimal-bigint';
import { CredentialsDto, UserDto } from './auth.dto';
import { IdentityRepository } from './identity.repository';

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
export class AuthService {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: CredentialsDto): Promise<UserDto> {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    try {
      return UserDto.from(
        await this.repository.createUser(dto.email, passwordHash),
      );
    } catch (error) {
      if (this.repository.isDuplicateEmail(error))
        throw new ConflictException('Email already registered');
      throw error;
    }
  }

  async login(dto: CredentialsDto) {
    const user = await this.repository.findByEmail(dto.email);
    if (!user) {
      // Match the expensive work for unknown accounts without storing a dummy password.
      await argon2.hash(dto.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!(await argon2.verify(user.passwordHash, dto.password)))
      throw new UnauthorizedException('Invalid email or password');
    const pair = await this.issue(user.id);
    await this.repository.createSession(pair.session);
    return pair.tokens;
  }

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

  async refresh(token: string) {
    const claims = await this.verify(token, 'refresh');
    const userId = parseDecimalBigInt(claims.sub);
    const next = await this.issue(userId);
    const rotated = await this.repository.rotateSession(
      { id: claims.jti, userId, tokenHash: this.hash(token) },
      next.session,
    );
    if (!rotated)
      throw new UnauthorizedException('Invalid or expired refresh session');
    return next.tokens;
  }

  async logout(token: string) {
    const claims = await this.verify(token, 'refresh');
    await this.repository.revokeSession(
      claims.jti,
      parseDecimalBigInt(claims.sub),
      this.hash(token),
    );
  }

  async me(id: bigint): Promise<UserDto> {
    const user = await this.repository.findById(id);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return UserDto.from(user);
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issue(userId: bigint) {
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
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000),
      },
    };
  }
}
