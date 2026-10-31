import { buildUpiUri, cleanTransactionRef, formatUpiAmount, isValidVpa } from './upi-uri';

describe('upi uri', () => {
  it('accepts well-formed VPAs and rejects malformed ones', () => {
    for (const ok of ['shop@okhdfcbank', 'shop.name-1@ybl', '9714571522@paytm', 'A_b@UPI']) {
      expect({ ok, valid: isValidVpa(ok) }).toEqual({ ok, valid: true });
    }
    for (const bad of ['', 'shop', '@ybl', 'shop@', 'sho p@ybl', 'shop@y', 'shop@bank.com', 'a@ybl', 'shop@@ybl', 'shop@ybl?x=1', '-shop@ybl']) {
      expect({ bad, valid: isValidVpa(bad) }).toEqual({ bad, valid: false });
    }
  });

  it('formats paise exactly with integer math', () => {
    expect(formatUpiAmount(1)).toBe('0.01');
    expect(formatUpiAmount(1050)).toBe('10.50');
    expect(formatUpiAmount(100)).toBe('1.00');
    expect(formatUpiAmount(123456789)).toBe('1234567.89');
    for (const bad of [0, -5, 10.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      expect(() => formatUpiAmount(bad)).toThrow(RangeError);
    }
  });

  it('builds pa, pn, am, cu, tn, tr in order', () => {
    const uri = buildUpiUri({
      vpa: 'ananda@okhdfcbank',
      payeeName: 'Ananda Cafe',
      amountMinorUnits: 52500,
      note: 'Bill ML-0042 Table 7',
      reference: 'ML-0042',
    });
    expect(uri).toBe('upi://pay?pa=ananda@okhdfcbank&pn=Ananda%20Cafe&am=525.00&cu=INR&tn=Bill%20ML-0042%20Table%207&tr=ML0042');
  });

  it('is parseable as a URL and never leaks injected query params through the text fields', () => {
    const uri = buildUpiUri({
      vpa: 'shop@ybl',
      payeeName: 'Tom & Jerry\'s <Bar>&am=1',
      amountMinorUnits: 99900,
      note: 'x&pa=evil@ybl#frag?',
      reference: 'A&B=1',
    });
    const u = new URL(uri);
    expect(u.protocol).toBe('upi:');
    expect(u.searchParams.get('pa')).toBe('shop@ybl');
    expect(u.searchParams.getAll('pa')).toHaveLength(1);
    expect(u.searchParams.getAll('am')).toEqual(['999.00']);
    expect(u.searchParams.get('tr')).toBe('AB1');
    expect(u.searchParams.get('pn')).not.toMatch(/[&<>=]/);
  });

  it('omits empty optional fields and caps lengths', () => {
    const uri = buildUpiUri({ vpa: 'shop@ybl', payeeName: 'Cafe', amountMinorUnits: 500, note: '   ', reference: '---' });
    expect(uri).toBe('upi://pay?pa=shop@ybl&pn=Cafe&am=5.00&cu=INR');
    const long = buildUpiUri({ vpa: 'shop@ybl', payeeName: 'Cafe', amountMinorUnits: 500, note: 'n'.repeat(200), reference: 'r'.repeat(80) });
    const u = new URL(long);
    expect((u.searchParams.get('tn') ?? '').length).toBe(80);
    expect((u.searchParams.get('tr') ?? '').length).toBe(35);
    expect(cleanTransactionRef('INV-2026/10 #7')).toBe('INV2026107');
  });

  it('keeps non-Latin payee names (Gujarati / Hindi) readable', () => {
    const uri = buildUpiUri({ vpa: 'shop@ybl', payeeName: 'રસોઈ ઘર', amountMinorUnits: 100 });
    expect(new URL(uri).searchParams.get('pn')).toBe('રસોઈ ઘર');
  });

  it('rejects an invalid VPA, a blank payee and a non-positive amount', () => {
    expect(() => buildUpiUri({ vpa: 'bad', payeeName: 'Cafe', amountMinorUnits: 100 })).toThrow(RangeError);
    expect(() => buildUpiUri({ vpa: 'shop@ybl', payeeName: '  &  ', amountMinorUnits: 100 })).toThrow(RangeError);
    expect(() => buildUpiUri({ vpa: 'shop@ybl', payeeName: 'Cafe', amountMinorUnits: 0 })).toThrow(RangeError);
  });
});
