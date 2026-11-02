import { ImageTooSmallError, PayloadTooLargeError, UnsupportedMediaError } from '../guestmenu.errors';
import { assertAcceptableSize, exifOrientation, inspectImage, sniffImage, stripMetadata, validBlur, validColor } from './image-sanitize';

/** Synthetic, minimal containers: enough structure for the header parsers, no real pixel data needed. */
const seg = (marker: number, payload: Buffer): Buffer => {
  const h = Buffer.alloc(4);
  h[0] = 0xff;
  h[1] = marker;
  h.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([h, payload]);
};
const sof0 = (w: number, h: number): Buffer => {
  const p = Buffer.alloc(15);
  p[0] = 8;
  p.writeUInt16BE(h, 1);
  p.writeUInt16BE(w, 3);
  p[5] = 3;
  return seg(0xc0, p);
};
const exifBlock = (orientation: number): Buffer => {
  // Exif\0\0 + TIFF(II, 42, IFD at 8) + 1 entry (0x0112 SHORT 1 value)
  const t = Buffer.alloc(8 + 2 + 12 + 4);
  t.write('II', 0, 'latin1');
  t.writeUInt16LE(42, 2);
  t.writeUInt32LE(8, 4);
  t.writeUInt16LE(1, 8);
  t.writeUInt16LE(0x0112, 10);
  t.writeUInt16LE(3, 12);
  t.writeUInt32LE(1, 14);
  t.writeUInt16LE(orientation, 18);
  return Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), t, Buffer.from('GPS-SECRET-LATLON')]);
};
const jpeg = (w: number, h: number, opts: { orientation?: number } = {}): Buffer =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0')),
    ...(opts.orientation ? [seg(0xe1, exifBlock(opts.orientation))] : []),
    seg(0xfe, Buffer.from('shot by Alice on her phone')),
    sof0(w, h),
    seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])),
    Buffer.from([1, 2, 3, 4, 5]),
    Buffer.from([0xff, 0xd9]),
  ]);

const crc = Buffer.alloc(4);
const chunk = (name: string, data: Buffer): Buffer => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  return Buffer.concat([len, Buffer.from(name, 'latin1'), data, crc]);
};
const png = (w: number, h: number, extra: Buffer[] = [], animated = false): Buffer => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...(animated ? [chunk('acTL', Buffer.alloc(8))] : []),
    ...extra,
    chunk('IDAT', Buffer.from([1, 2, 3])),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const webpChunk = (name: string, data: Buffer): Buffer => {
  const h = Buffer.alloc(8);
  h.write(name, 0, 'latin1');
  h.writeUInt32LE(data.length, 4);
  return Buffer.concat([h, data, data.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]);
};
const webpX = (w: number, h: number, flags = 0x08): Buffer => {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = flags;
  vp8x.writeUIntLE(w - 1, 4, 3);
  vp8x.writeUIntLE(h - 1, 7, 3);
  const body = Buffer.concat([
    Buffer.from('WEBP', 'latin1'),
    webpChunk('VP8X', vp8x),
    webpChunk('EXIF', Buffer.from('camera-serial-1234')),
    webpChunk('VP8 ', Buffer.alloc(20)),
  ]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
};

describe('sniffImage', () => {
  it('decides the type from magic bytes only', () => {
    expect(sniffImage(jpeg(100, 100))).toBe('jpeg');
    expect(sniffImage(png(100, 100))).toBe('png');
    expect(sniffImage(webpX(100, 100))).toBe('webp');
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from('GIF89a.....'))).toBeNull();
    expect(sniffImage(Buffer.from('MZ\x90\0'))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
  });
});

describe('inspectImage', () => {
  it('reads dimensions and orientation without decoding', () => {
    expect(inspectImage(jpeg(640, 480, { orientation: 6 }), 'jpeg')).toMatchObject({ width: 640, height: 480, orientation: 6, animated: false });
    expect(inspectImage(jpeg(640, 480), 'jpeg').orientation).toBe(1);
    expect(inspectImage(png(800, 600), 'png')).toMatchObject({ width: 800, height: 600, animated: false });
    expect(inspectImage(png(800, 600, [], true), 'png').animated).toBe(true);
    expect(inspectImage(webpX(320, 200), 'webp')).toMatchObject({ width: 320, height: 200, animated: false });
    expect(inspectImage(webpX(320, 200, 0x02), 'webp').animated).toBe(true);
  });

  it('rejects truncated or malformed files', () => {
    expect(() => inspectImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), 'jpeg')).toThrow(UnsupportedMediaError);
    expect(() => inspectImage(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(10)]), 'png')).toThrow(UnsupportedMediaError);
    expect(() => inspectImage(Buffer.from('RIFF\0\0\0\0WEBP'), 'webp')).toThrow(UnsupportedMediaError);
  });

  it('parses the EXIF orientation tag in both byte orders and ignores garbage', () => {
    const block = exifBlock(8).subarray(6);
    expect(exifOrientation(block)).toBe(8);
    expect(exifOrientation(Buffer.from('nope'))).toBe(1);
    const bad = Buffer.from(block);
    bad.writeUInt16LE(99, 18);
    expect(exifOrientation(bad)).toBe(1);
  });
});

describe('assertAcceptableSize', () => {
  const info = (w: number, h: number, animated = false) => ({ kind: 'png' as const, width: w, height: h, orientation: 1, animated });
  it('accepts normal photos', () => expect(() => assertAcceptableSize(info(1600, 1200))).not.toThrow());
  it('refuses tiny pictures with their own code (still a 415)', () => {
    expect(() => assertAcceptableSize(info(32, 800))).toThrow(UnsupportedMediaError);
    expect(() => assertAcceptableSize(info(32, 800))).toThrow(ImageTooSmallError);
    try {
      assertAcceptableSize(info(800, 32));
    } catch (e) {
      expect(e).toMatchObject({ code: 'IMAGE_TOO_SMALL', httpStatus: 415, details: { minSidePx: 64, width: 800, height: 32 } });
    }
  });
  it('refuses animation', () => expect(() => assertAcceptableSize(info(800, 800, true))).toThrow(UnsupportedMediaError));
  it('refuses decompression bombs (413)', () => {
    expect(() => assertAcceptableSize(info(7000, 700))).toThrow(PayloadTooLargeError);
    expect(() => assertAcceptableSize(info(5900, 5900))).toThrow(PayloadTooLargeError);
  });
});

describe('stripMetadata', () => {
  it('drops EXIF (GPS), comments from a JPEG but keeps the picture and JFIF header', () => {
    const src = jpeg(640, 480, { orientation: 1 });
    expect(src.includes(Buffer.from('GPS-SECRET-LATLON'))).toBe(true);
    const out = stripMetadata(src, 'jpeg');
    expect(out.includes(Buffer.from('GPS-SECRET-LATLON'))).toBe(false);
    expect(out.includes(Buffer.from('Alice'))).toBe(false);
    expect(out.includes(Buffer.from('JFIF'))).toBe(true);
    expect(inspectImage(out, 'jpeg')).toMatchObject({ width: 640, height: 480 });
    expect(out.subarray(out.length - 7).equals(Buffer.from([1, 2, 3, 4, 5, 0xff, 0xd9]))).toBe(true);
  });

  it('drops text/time/exif chunks from a PNG', () => {
    const src = png(200, 200, [chunk('tEXt', Buffer.from('Author\0Alice')), chunk('eXIf', Buffer.from('secret')), chunk('tIME', Buffer.alloc(7))]);
    const out = stripMetadata(src, 'png');
    expect(out.includes(Buffer.from('Alice'))).toBe(false);
    expect(out.includes(Buffer.from('secret'))).toBe(false);
    expect(out.includes(Buffer.from('IDAT'))).toBe(true);
    expect(inspectImage(out, 'png')).toMatchObject({ width: 200, height: 200 });
  });

  it('drops EXIF/XMP chunks and flags from a WebP and keeps a valid RIFF length', () => {
    const out = stripMetadata(webpX(300, 300), 'webp');
    expect(out.includes(Buffer.from('camera-serial'))).toBe(false);
    expect(out.readUInt32LE(4) + 8).toBe(out.length);
    expect(out[20] & 0x08).toBe(0);
    expect(inspectImage(out, 'webp')).toMatchObject({ width: 300, height: 300 });
  });

  it('refuses a damaged file instead of passing it through', () => {
    expect(() => stripMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00]), 'jpeg')).toThrow(UnsupportedMediaError);
    expect(() => stripMetadata(png(100, 100).subarray(0, 40), 'png')).toThrow(UnsupportedMediaError);
  });
});

describe('client supplied placeholders', () => {
  it('validColor accepts #rrggbb only', () => {
    expect(validColor('#1DBA3C')).toBe('#1dba3c');
    expect(validColor('red')).toBeNull();
    expect(validColor('#12345')).toBeNull();
    expect(validColor('#1dba3c;background:url(x)')).toBeNull();
  });
  it('validBlur accepts a small data URI image and nothing else', () => {
    expect(validBlur('data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==')).not.toBeNull();
    expect(validBlur('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(validBlur('javascript:alert(1)')).toBeNull();
    expect(validBlur(42)).toBeNull();
  });
});
