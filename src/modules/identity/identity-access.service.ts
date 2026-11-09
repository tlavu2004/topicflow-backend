import { Injectable } from '@nestjs/common';
import { TokenService } from './token.service';

export interface IdentityPrincipal {
  readonly userId: string;
}

/** Public identity capability; never exposes refresh tokens or persistence. */
@Injectable()
export class IdentityAccessService {
  constructor(private readonly tokens: TokenService) {}

  async authenticateAccessToken(token: string): Promise<IdentityPrincipal> {
    const claims = await this.tokens.verify(token, 'access');
    return { userId: claims.sub };
  }
}
