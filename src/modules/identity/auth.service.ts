import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { parseDecimalBigInt } from '../../common/http/decimal-bigint';
import type { Credentials, TokenPair, UserResult } from './auth.types';
import { IdentityRepository } from './identity.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: Credentials): Promise<UserResult> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      const user = await this.repository.createUser(input.email, passwordHash);
      return { id: user.id, email: user.email };
    } catch (error) {
      if (this.repository.isDuplicateEmail(error))
        throw new ConflictException('Email already registered');
      throw error;
    }
  }

  async login(input: Credentials): Promise<TokenPair> {
    const user = await this.repository.findByEmail(input.email);
    if (!user) {
      // Match the expensive work for unknown accounts without storing a dummy password.
      await this.passwords.hash(input.password);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!(await this.passwords.verify(user.passwordHash, input.password)))
      throw new UnauthorizedException('Invalid email or password');
    const pair = await this.tokens.issue(user.id);
    await this.repository.createSession(pair.session);
    return pair.tokens;
  }

  async refresh(token: string): Promise<TokenPair> {
    const claims = await this.tokens.verify(token, 'refresh');
    const userId = parseDecimalBigInt(claims.sub);
    const next = await this.tokens.issue(userId);
    const rotated = await this.repository.rotateSession(
      { id: claims.jti, userId, tokenHash: this.tokens.fingerprint(token) },
      next.session,
    );
    if (!rotated)
      throw new UnauthorizedException('Invalid or expired refresh session');
    return next.tokens;
  }

  async logout(token: string): Promise<void> {
    const claims = await this.tokens.verify(token, 'refresh');
    await this.repository.revokeSession(
      claims.jti,
      parseDecimalBigInt(claims.sub),
      this.tokens.fingerprint(token),
    );
  }

  async me(id: bigint): Promise<UserResult> {
    const user = await this.repository.findById(id);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return { id: user.id, email: user.email };
  }
}
