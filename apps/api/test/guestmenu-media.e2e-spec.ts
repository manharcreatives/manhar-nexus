import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import request from 'supertest';
import { bootstrap, relaxLimits, uuid, type Fixture } from './guestmenu-harness';

relaxLimits();
const MEDIA = mkdtempSync(join(tmpdir(), 'nexus-media-e2e-'));
process.env.MEDIA_DIR = MEDIA;
jest.setTimeout(240_000);

// ── Real, decodable PNGs built in memory (valid for sharp too, so the spec does not depend on its presence) ──
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Buffer): number => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (name: string, data: Buffer): Buffer => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(name, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(w: number, h: number, opts: { text?: string; animated?: boolean; pad?: number } = {}): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x9a)]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...(opts.animated ? [chunk('acTL', Buffer.alloc(8))] : []),
    ...(opts.text ? [chunk('tEXt', Buffer.from(`Comment\0${opts.text}`))] : []),
    ...(opts.pad ? [chunk('tEXt', Buffer.concat([Buffer.from('Pad\0'), Buffer.alloc(opts.pad, 0x41)]))] : []),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('QR digital menu pictures (e2e)', () => {
  let f: Fixture;
  const http = () => f.http();
  const upload = (tok: string | null, path: string, file: Buffer | null, name = 'dish.png', type = 'image/png', fields: Record<string, string> = {}) => {
    let r = request(http()).post(path);
    if (tok) r = r.set('authorization', `Bearer ${tok}`);
    for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
    return file ? r.attach('file', file, { filename: name, contentType: type }) : r;
  };
  const media = (url: string) => request(http()).get(url);
  const files = () => {
    try {
      return readdirSync(join(MEDIA, f.bizId));
    } catch {
      return [] as string[];
    }
  };

  beforeAll(async () => {
    f = await bootstrap('gi');
  });
  afterAll(async () => {
    await f.close();
    rmSync(MEDIA, { recursive: true, force: true });
  });

  it('uploads an item picture: stored by content hash, metadata removed, served publicly with immutable caching and a 304', async () => {
    const secret = 'GPS-LAT-12.97-LON-77.59';
    const res = await upload(f.ownerToken, `/admin/menu/items/${f.ids.burger}/image`, png(320, 240, { text: secret }), 'burger.png', 'image/png', { color: '#aabbcc' });
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toMatch(new RegExp(`^/media/${f.bizId}/[0-9a-f]{40}(-\\d+)?\\.(png|webp|jpg)$`));
    expect(res.body.itemId).toBe(f.ids.burger);

    const got = await media(res.body.imageUrl);
    expect(got.status).toBe(200);
    expect(got.headers['content-type']).toMatch(/^image\/(png|webp|jpeg)$/);
    expect(got.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(got.headers['x-content-type-options']).toBe('nosniff');
    expect(got.headers['content-security-policy']).toContain("default-src 'none'");
    expect((got.body as Buffer).includes(Buffer.from(secret))).toBe(false);

    const again = await media(res.body.imageUrl).set('if-none-match', got.headers.etag as string);
    expect(again.status).toBe(304);

    // the staff catalog list (photo manager) carries the same relative URL
    const staffList = await f.get(f.ownerToken, '/admin/catalog/items');
    expect((staffList.body as { id: string; imageUrl: string | null }[]).find((i) => i.id === f.ids.burger)!.imageUrl).toBe(res.body.imageUrl);

    const t = await f.table('IMG', { open: false });
    const menu = await f.pub.get(await f.qrToken(t.tableId));
    const item = (menu.body.items as { id: string; imageUrl: string | null }[]).find((i) => i.id === f.ids.burger)!;
    expect(item.imageUrl).toMatch(/^https?:\/\/[^/]+\/media\//);
    expect(item.imageUrl!.endsWith(res.body.imageUrl)).toBe(true);
  });

  it('replacing the picture removes the previous file; deleting is idempotent and removes the file', async () => {
    const first = await upload(f.ownerToken, `/admin/menu/items/${f.ids.tea}/image`, png(200, 200), 'a.png');
    expect(first.status).toBe(200);
    const second = await upload(f.ownerToken, `/admin/menu/items/${f.ids.tea}/image`, png(210, 200), 'b.png');
    expect(second.status).toBe(200);
    expect(second.body.imageUrl).not.toBe(first.body.imageUrl);
    expect((await media(first.body.imageUrl)).status).toBe(404);
    expect((await media(second.body.imageUrl)).status).toBe(200);
    const del = await f.del(f.ownerToken, `/admin/menu/items/${f.ids.tea}/image`);
    expect(del.status).toBe(204);
    expect((await f.del(f.ownerToken, `/admin/menu/items/${f.ids.tea}/image`)).status).toBe(204);
    expect((await media(second.body.imageUrl)).status).toBe(404);
  });

  it('the same picture on two items is stored once and survives until the last one lets go', async () => {
    const img = png(256, 256);
    const a = await upload(f.ownerToken, `/admin/menu/items/${f.ids.pizza}/image`, img);
    const b = await upload(f.ownerToken, `/admin/menu/items/${f.ids.soldOut}/image`, img);
    expect(a.body.imageUrl).toBe(b.body.imageUrl);
    expect((await f.del(f.ownerToken, `/admin/menu/items/${f.ids.pizza}/image`)).status).toBe(204);
    expect((await media(b.body.imageUrl)).status).toBe(200);
    expect((await f.del(f.ownerToken, `/admin/menu/items/${f.ids.soldOut}/image`)).status).toBe(204);
    expect((await media(b.body.imageUrl)).status).toBe(404);
  });

  it('validates what is uploaded by content, not by name or declared type', async () => {
    const url = `/admin/menu/items/${f.ids.burger}/image`;
    const none = await upload(f.ownerToken, url, null);
    expect(none.status).toBe(400);
    expect(none.body.error.details.reason).toBe('FILE_REQUIRED');

    const html = await upload(f.ownerToken, url, Buffer.from('<html><script>alert(1)</script></html>'), 'x.png', 'image/png');
    expect(html.status).toBe(415);
    expect(html.body.error.code).toBe('UNSUPPORTED_MEDIA');
    const svg = await upload(f.ownerToken, url, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'x.svg', 'image/svg+xml');
    expect(svg.status).toBe(415);
    const gif = await upload(f.ownerToken, url, Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;', 'latin1'), 'x.gif', 'image/gif');
    expect(gif.status).toBe(415);
    const exe = await upload(f.ownerToken, url, Buffer.from('MZ\x90\x00\x03'), 'x.png', 'image/png');
    expect(exe.status).toBe(415);
    const truncated = await upload(f.ownerToken, url, png(300, 300).subarray(0, 40));
    expect(truncated.status).toBe(415);
    const tiny = await upload(f.ownerToken, url, png(16, 16));
    expect(tiny.status).toBe(415);
    const animated = await upload(f.ownerToken, url, png(200, 200, { animated: true }));
    expect(animated.status).toBe(415);
    const huge = await upload(f.ownerToken, url, png(6100, 64));
    expect(huge.status).toBe(413);
    expect(huge.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(files().filter((n) => n.startsWith('.'))).toEqual([]); // no temp files left behind
  });

  it('enforces the byte limit (413) at runtime and at the multipart layer', async () => {
    const url = `/admin/menu/items/${f.ids.burger}/image`;
    process.env.MEDIA_MAX_UPLOAD_BYTES = '100000';
    try {
      const over = await upload(f.ownerToken, url, png(200, 200, { pad: 150_000 }));
      expect(over.status).toBe(413);
      expect(over.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    } finally {
      delete process.env.MEDIA_MAX_UPLOAD_BYTES;
    }
    const hard = await upload(f.ownerToken, url, png(200, 200, { pad: 7 * 1024 * 1024 }));
    expect(hard.status).toBe(413);
  });

  it('is limited to people with restaurant.qr.manage, tenant-scoped, and rejects bad ids', async () => {
    const url = `/admin/menu/items/${f.ids.burger}/image`;
    expect((await upload(null, url, png(200, 200))).status).toBe(401);
    expect((await upload(f.kitchenToken, url, png(200, 200))).status).toBe(403);
    expect((await upload(f.waiterToken, url, png(200, 200))).status).toBe(403);
    expect((await f.del(f.waiterToken, url)).status).toBe(403);
    expect((await upload(f.other.ownerToken, url, png(200, 200))).status).toBe(404);
    expect((await f.del(f.other.ownerToken, url)).status).toBe(404);
    expect((await upload(f.ownerToken, `/admin/menu/items/${uuid()}/image`, png(200, 200))).status).toBe(404);
    expect((await upload(f.ownerToken, '/admin/menu/items/not-a-uuid/image', png(200, 200))).status).toBe(400);
  });

  it('serves only well-formed content-hash names: no traversal, no other tenant, no guessing', async () => {
    const up = await upload(f.ownerToken, `/admin/menu/items/${f.ids.burger}/image`, png(300, 200));
    const name = (up.body.imageUrl as string).split('/').pop()!;
    expect((await media(`/media/${f.bizId}/${name}`)).status).toBe(200);
    expect((await media(`/media/${f.other.bizId}/${name}`)).status).toBe(404);
    expect((await media(`/media/${f.bizId}/..%2F..%2Fetc%2Fpasswd`)).status).toBe(404);
    expect((await media(`/media/${f.bizId}/%2e%2e%2f${name}`)).status).toBe(404);
    expect((await media(`/media/not-a-uuid/${name}`)).status).toBe(404);
    expect((await media(`/media/${f.bizId}/${'0'.repeat(40)}.png`)).status).toBe(404);
    expect((await media(`/media/${f.bizId}/${name}.exe`)).status).toBe(404);
    expect((await media(`/media/${f.bizId}/${name.replace(/\.\w+$/, '.html')}`)).status).toBe(404);
  });

  it('category pictures and the brand logo / cover work the same way and show up in the public menu', async () => {
    const cat = await upload(f.ownerToken, `/admin/menu/categories/${f.ids.cat}/image`, png(400, 300));
    expect(cat.status).toBe(200);
    expect(cat.body.categoryId).toBe(f.ids.cat);
    const logo = await upload(f.ownerToken, '/admin/qr/settings/logo', png(128, 128), 'logo.png', 'image/png', { color: '#112233' });
    expect(logo.status).toBe(200);
    expect(logo.body).toMatchObject({ kind: 'logo' });
    const cover = await upload(f.ownerToken, '/admin/qr/settings/cover', png(600, 300));
    expect(cover.status).toBe(200);
    expect((await upload(f.ownerToken, '/admin/qr/settings/banner', png(600, 300))).status).toBe(400);

    const t = await f.table('BRAND', { open: false });
    const menu = await f.pub.get(await f.qrToken(t.tableId));
    expect(menu.body.business.logoUrl).toContain(logo.body.imageUrl);
    expect(menu.body.business.coverUrl).toContain(cover.body.imageUrl);
    expect((menu.body.categories as { id: string; imageUrl: string | null }[]).find((c) => c.id === f.ids.cat)!.imageUrl).toContain(cat.body.imageUrl);

    expect((await f.del(f.ownerToken, '/admin/qr/settings/logo')).status).toBe(204);
    expect((await f.del(f.ownerToken, '/admin/qr/settings/cover')).status).toBe(204);
    expect((await f.del(f.ownerToken, `/admin/menu/categories/${f.ids.cat}/image`)).status).toBe(204);
    const after = await f.pub.get(await f.qrToken(t.tableId));
    expect(after.body.business.logoUrl).toBeNull();
    expect(after.body.business.coverUrl).toBeNull();
  });

  it('presentation fields (veg/non-veg, tags, spice) are validated and appear in the public menu', async () => {
    const url = `/admin/menu/items/${f.ids.burger}/presentation`;
    expect((await f.patch(f.waiterToken, url, { dietType: 'VEG' })).status).toBe(403);
    expect((await f.patch(f.ownerToken, url, { dietType: 'MEAT' })).status).toBe(400);
    expect((await f.patch(f.ownerToken, url, { spiceLevel: 9 })).status).toBe(400);
    expect((await f.patch(f.ownerToken, url, {})).status).toBe(400);
    expect((await f.patch(f.other.ownerToken, url, { dietType: 'VEG' })).status).toBe(404);
    const ok = await f.patch(f.ownerToken, url, { dietType: 'NONVEG', menuTags: ['bestseller', 'bestseller', 'chef pick'], spiceLevel: 2 });
    expect(ok.status).toBe(200);
    const t = await f.table('PRES', { open: false });
    const menu = await f.pub.get(await f.qrToken(t.tableId));
    const item = (menu.body.items as { id: string; veg: string | null; tags: string[]; spice: number | null }[]).find((i) => i.id === f.ids.burger)!;
    expect(item).toMatchObject({ veg: 'nonveg', tags: ['bestseller', 'chef pick'], spice: 2 });
  });
});
