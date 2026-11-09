import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

export interface IdentityPrincipal {
  readonly userId: string;
}

/** Public identity capability; never exposes refresh tokens or persistence. */
@Injectable()
export class IdentityAccessService {
  constructor(private readonly auth: AuthService) {}

  async authenticateAccessToken(token: string): Promise<IdentityPrincipal> {
    const claims = await this.auth.verify(token, 'access');
    return { userId: claims.sub };
  }
}
