import { parseDecimalBigInt, serializeDecimalBigInt } from './decimal-bigint';

describe('decimal PostgreSQL BIGINT API boundary', () => {
  it('round-trips an ID or ID-based feed cursor beyond Number.MAX_SAFE_INTEGER', () => {
    const id = 9_007_199_254_740_993n;
    const json = JSON.stringify({ id: serializeDecimalBigInt(id) });
    expect(json).toBe('{"id":"9007199254740993"}');
    const parsed: unknown = JSON.parse(json);
    expect(parseDecimalBigInt((parsed as { id: string }).id)).toBe(id);
    expect(parseDecimalBigInt(serializeDecimalBigInt(id))).toBe(id);
  });

  it.each([
    '0',
    '-1',
    '+1',
    '01',
    '1.0',
    ' 1',
    '9223372036854775808',
    '9'.repeat(1000),
  ])('rejects invalid ID %s', (value) => {
    expect(() => parseDecimalBigInt(value)).toThrow();
  });
});
