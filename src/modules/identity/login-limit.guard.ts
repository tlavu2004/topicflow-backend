import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class LoginLimitGuard implements CanActivate {
  private readonly attempts = new Map<
    string,
    { count: number; resetAt: number }
  >();

  canActivate(context: ExecutionContext): boolean {
    const now = Date.now();
    for (const [key, entry] of this.attempts) {
      if (entry.resetAt <= now) this.attempts.delete(key);
    }
    const http = context.switchToHttp();
    const key = http.getRequest<Request>().ip ?? 'unknown';
    let entry = this.attempts.get(key);
    if (!entry) {
      if (this.attempts.size >= 10000)
        throw new HttpException('Login capacity reached', 429);
      entry = { count: 0, resetAt: now + 60000 };
      this.attempts.set(key, entry);
    }
    if (++entry.count > 10) {
      http
        .getResponse<Response>()
        .setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      throw new HttpException('Too many authentication attempts', 429);
    }
    return true;
  }
}
