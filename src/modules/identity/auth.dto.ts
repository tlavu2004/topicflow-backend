import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  DECIMAL_BIGINT_PATTERN,
  serializeDecimalBigInt,
} from '../../common/http/decimal-bigint';

export class CredentialsDto {
  @ApiProperty({ example: 'reader@example.com', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, format: 'password' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class UserDto {
  @ApiProperty({
    type: String,
    pattern: DECIMAL_BIGINT_PATTERN,
    example: '9007199254740993',
  })
  id!: string;

  @ApiProperty()
  email!: string;

  static from(user: { id: bigint; email: string }): UserDto {
    return { id: serializeDecimalBigInt(user.id), email: user.email };
  }
}

export class TokenPairDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ example: 'Bearer' }) tokenType!: string;
  @ApiProperty({ example: 900 }) expiresIn!: number;
}
