/** Internal application contracts, independent of HTTP/Swagger and Prisma. */
export interface Credentials {
  email: string;
  password: string;
}

export interface UserResult {
  id: bigint;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}
