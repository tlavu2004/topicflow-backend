import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class IdentityRepository {
  constructor(private readonly db: PrismaService) {}

  createUser(email: string, passwordHash: string) {
    return this.db.user.create({ data: { email, passwordHash } });
  }

  isDuplicateEmail(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  findById(id: bigint) {
    return this.db.user.findUnique({ where: { id } });
  }

  createSession(data: {
    id: string;
    userId: bigint;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.db.refreshSession.create({ data });
  }

  async rotateSession(
    old: { id: string; userId: bigint; tokenHash: string },
    next: { id: string; userId: bigint; tokenHash: string; expiresAt: Date },
  ) {
    return this.db.$transaction(async (tx) => {
      const consumed = await tx.refreshSession.deleteMany({
        where: { ...old, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) return false;
      await tx.refreshSession.create({ data: next });
      return true;
    });
  }

  async revokeSession(id: string, userId: bigint, tokenHash: string) {
    await this.db.refreshSession.deleteMany({
      where: { id, userId, tokenHash },
    });
  }
}
