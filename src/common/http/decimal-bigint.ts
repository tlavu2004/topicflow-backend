import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;
export const DECIMAL_BIGINT_PATTERN = '^[1-9][0-9]*$';
const decimalBigIntRegex = new RegExp(DECIMAL_BIGINT_PATTERN);

export function parseDecimalBigInt(value: string): bigint {
  if (
    typeof value !== 'string' ||
    value.length > 19 ||
    !decimalBigIntRegex.test(value)
  ) {
    throw new BadRequestException('ID must be a positive decimal string');
  }
  const parsed = BigInt(value);
  if (parsed > MAX_POSTGRES_BIGINT) {
    throw new BadRequestException('ID exceeds PostgreSQL BIGINT range');
  }
  return parsed;
}

export function serializeDecimalBigInt(value: bigint): string {
  if (value < 1n || value > MAX_POSTGRES_BIGINT) {
    throw new RangeError('ID is outside PostgreSQL BIGINT range');
  }
  return value.toString(10);
}

@Injectable()
export class ParseDecimalBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    return parseDecimalBigInt(value);
  }
}
