import {
  REFERENCE_ALPHABET,
  REFERENCE_CODE_PATTERN,
  USER_AGENT_MAX,
  generateReferenceCode,
  hashIp,
  normaliseIp,
  truncateUserAgent,
} from './registration.util';

describe('generateReferenceCode', () => {
  it('has the NX- prefix and 6 characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateReferenceCode()).toMatch(REFERENCE_CODE_PATTERN);
    }
  });

  it('never uses look-alike characters (0 O 1 I L U)', () => {
    expect(REFERENCE_ALPHABET).not.toMatch(/[01OILU]/);
    expect(new Set(REFERENCE_ALPHABET).size).toBe(REFERENCE_ALPHABET.length);
  });

  it('maps the injected randomness onto the alphabet deterministically', () => {
    let i = 0;
    const code = generateReferenceCode(() => i++);
    expect(code).toBe(`NX-${REFERENCE_ALPHABET.slice(0, 6)}`);
    expect(generateReferenceCode(() => REFERENCE_ALPHABET.length - 1)).toBe(
      `NX-${REFERENCE_ALPHABET.at(-1)!.repeat(6)}`,
    );
  });

  it('asks the generator for values strictly below the alphabet size', () => {
    const seen: number[] = [];
    generateReferenceCode((max) => {
      seen.push(max);
      return 0;
    });
    expect(seen).toEqual(new Array(6).fill(REFERENCE_ALPHABET.length));
  });

  it('produces distinct codes across many draws (collision sanity, not a guarantee)', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateReferenceCode()));
    expect(codes.size).toBeGreaterThan(1990);
  });
});

describe('hashIp', () => {
  const secret = 'unit-test-secret-0123456789abcdef';

  it('is a 64-char hex HMAC-SHA256 and never contains the raw IP', () => {
    const h = hashIp('203.0.113.7', secret);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('203');
  });

  it('is deterministic for the same ip + secret', () => {
    expect(hashIp('203.0.113.7', secret)).toBe(hashIp('203.0.113.7', secret));
  });

  it('differs per ip and per secret (keyed, not a bare hash)', () => {
    expect(hashIp('203.0.113.7', secret)).not.toBe(hashIp('203.0.113.8', secret));
    expect(hashIp('203.0.113.7', secret)).not.toBe(hashIp('203.0.113.7', `${secret}x`));
  });

  it('treats IPv4-mapped IPv6 and plain IPv4 as the same client', () => {
    expect(hashIp('::ffff:203.0.113.7', secret)).toBe(hashIp('203.0.113.7', secret));
    expect(normaliseIp(' ::FFFF:203.0.113.7 ')).toBe('203.0.113.7');
    expect(normaliseIp('2001:db8::1')).toBe('2001:db8::1');
  });

  it('returns null when there is no usable ip', () => {
    expect(hashIp(undefined, secret)).toBeNull();
    expect(hashIp(null, secret)).toBeNull();
    expect(hashIp('   ', secret)).toBeNull();
  });
});

describe('truncateUserAgent', () => {
  it('truncates to 200 characters', () => {
    const out = truncateUserAgent('a'.repeat(500));
    expect(out).toHaveLength(USER_AGENT_MAX);
    expect(USER_AGENT_MAX).toBe(200);
  });

  it('keeps short values and maps empty or missing to null', () => {
    expect(truncateUserAgent('Mozilla/5.0')).toBe('Mozilla/5.0');
    expect(truncateUserAgent('')).toBeNull();
    expect(truncateUserAgent('   ')).toBeNull();
    expect(truncateUserAgent(undefined)).toBeNull();
  });
});
