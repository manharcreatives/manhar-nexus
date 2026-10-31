/**
 * Mock backend for ?mock=1 / VITE_MENU_MOCK=1. Same interface as the HTTP client, rich Indian-restaurant data,
 * a scripted order lifecycle and a fake live stream, so the whole panel can be reviewed without the API.
 * Loaded lazily (dynamic import in api.ts): never part of the production menu chunk.
 */
import { ApiError, type MenuApi, type MockOptions } from './api';
import type {
  BillState, GuestSession, MenuItem, MenuPayload, PayIntent, PlaceOrderBody, StateOrder, StreamEventName, StreamHandlers,
  TableState, WaiterReason,
} from './types';

const P = '/landing/';
const img = (n: string) => `${P}${n}-800.webp`;

const ITEMS: MenuItem[] = [
  { id: 'i1', categoryId: 'c1', name: 'Kesari Paneer Tikka', description: 'Charcoal-kissed paneer, saffron yoghurt, hung-curd mint dip.', priceMinor: 42000, imageUrl: img('chef-hands-plating'), veg: 'veg', tags: ['signature', "chef's pick"], spice: 1, soldOut: false, variants: [], addOnGroups: [{ id: 'g1', name: 'Dips', min: 0, max: 2, options: [{ id: 'o1', name: 'Mint chutney', priceMinor: 1500 }, { id: 'o2', name: 'Smoked garlic mayo', priceMinor: 2500 }] }] },
  { id: 'i2', categoryId: 'c1', name: 'Dahi ke Kebab', description: 'Melt-in-mouth hung-curd kebabs with roasted cumin and ghee.', priceMinor: 38000, imageUrl: img('table-setting-topdown'), veg: 'veg', tags: ['bestseller'], spice: 1, soldOut: false, variants: [], addOnGroups: [] },
  { id: 'i3', categoryId: 'c1', name: 'Chicken Malai Tikka', description: 'Cream-marinated thigh, green cardamom, slow tandoor.', priceMinor: 46000, imageUrl: img('hero-pass-evening'), veg: 'nonveg', tags: ['signature'], spice: 1, soldOut: false, variants: [{ id: 'v1', name: '6 pieces', priceMinor: 46000 }, { id: 'v2', name: '10 pieces', priceMinor: 72000 }], addOnGroups: [] },
  { id: 'i4', categoryId: 'c1', name: 'Crispy Corn Chaat', description: 'Golden corn, tamarind glaze, pomegranate, sev.', priceMinor: 29000, veg: 'veg', tags: [], spice: 2, soldOut: false, variants: [], addOnGroups: [] },
  { id: 'i5', categoryId: 'c2', name: 'Hyderabadi Dum Biryani', description: 'Aged basmati sealed with saffron and whole spice, cooked on dum for two hours.', priceMinor: 52000, imageUrl: img('indian-thali-overhead'), veg: 'nonveg', tags: ['signature', 'bestseller'], spice: 3, soldOut: false, variants: [{ id: 'v3', name: 'Half', priceMinor: 52000 }, { id: 'v4', name: 'Full', priceMinor: 89000 }], addOnGroups: [{ id: 'g2', name: 'Make it yours', min: 0, max: 3, options: [{ id: 'o3', name: 'Burani raita', priceMinor: 6000 }, { id: 'o4', name: 'Mirchi ka salan', priceMinor: 8000 }, { id: 'o5', name: 'Extra masala egg', priceMinor: 5000 }] }] },
  { id: 'i6', categoryId: 'c2', name: 'Dal Makhani', description: 'Black lentils, overnight on the embers, finished with cultured butter.', priceMinor: 36000, imageUrl: img('closing-counter-lamp'), veg: 'veg', tags: ["chef's pick"], spice: 0, soldOut: false, variants: [], addOnGroups: [] },
  { id: 'i7', categoryId: 'c2', name: 'Butter Chicken', description: 'Tandoori chicken in a silk tomato and fenugreek gravy.', priceMinor: 54000, imageUrl: img('restaurant-dining-golden-hour'), veg: 'nonveg', tags: ['bestseller'], spice: 1, soldOut: false, variants: [], addOnGroups: [{ id: 'g3', name: 'Spice level', min: 1, max: 1, options: [{ id: 'o6', name: 'Mild', priceMinor: 0 }, { id: 'o7', name: 'Medium', priceMinor: 0 }, { id: 'o8', name: 'Fiery', priceMinor: 0 }] }] },
  { id: 'i8', categoryId: 'c2', name: 'Paneer Lababdar', description: 'Soft paneer in a cashew-onion gravy with a whisper of kasuri methi.', priceMinor: 44000, imageUrl: img('boutique-hotel-dining'), veg: 'veg', tags: [], spice: 1, soldOut: true, variants: [], addOnGroups: [] },
  { id: 'i9', categoryId: 'c2', name: 'Royal Thali', description: 'A curated spread of seven small plates, bread, rice and dessert.', priceMinor: 79000, imageUrl: img('indian-thali-overhead'), veg: 'veg', tags: ['signature'], spice: 1, soldOut: false, variants: [], addOnGroups: [] },
  { id: 'i10', categoryId: 'c3', name: 'Butter Garlic Naan', description: 'Hand-stretched, blistered in the tandoor.', priceMinor: 9000, veg: 'veg', tags: [], spice: 0, soldOut: false, variants: [], addOnGroups: [] },
  { id: 'i11', categoryId: 'c3', name: 'Jeera Rice', description: 'Long-grain basmati, ghee-tempered cumin.', priceMinor: 18000, veg: 'veg', tags: [], spice: 0, soldOut: false, variants: [], addOnGroups: [] },
  { id: 'i12', categoryId: 'c4', name: 'Gulab Jamun, warm', description: 'Khoya dumplings in cardamom syrup with a pistachio dust.', priceMinor: 22000, imageUrl: img('bakery-morning-display'), veg: 'veg', tags: ['bestseller'], spice: 0, soldOut: false, variants: [], addOnGroups: [{ id: 'g4', name: 'Add a scoop', min: 0, max: 1, options: [{ id: 'o9', name: 'Vanilla bean', priceMinor: 6000 }, { id: 'o10', name: 'Kesar pista', priceMinor: 7000 }] }] },
  { id: 'i13', categoryId: 'c4', name: 'Kulfi Falooda', description: 'Slow-reduced milk kulfi, rose, vermicelli, basil seeds.', priceMinor: 26000, imageUrl: img('specialty-cafe-counter'), veg: 'veg', tags: [], spice: 0, soldOut: false, variants: [], addOnGroups: [] },
  { id: 'i14', categoryId: 'c5', name: 'Masala Chai', description: 'Assam, ginger, green cardamom, jaggery.', priceMinor: 9000, veg: 'veg', tags: [], spice: 0, soldOut: false, variants: [{ id: 'v5', name: 'Cutting', priceMinor: 9000 }, { id: 'v6', name: 'Pot for two', priceMinor: 22000 }], addOnGroups: [] },
  { id: 'i15', categoryId: 'c5', name: 'Smoked Orange Cooler', description: 'Orange, rosemary smoke, tonic, black salt.', priceMinor: 21000, imageUrl: img('bar-pour-evening'), veg: 'veg', tags: ["chef's pick"], spice: 0, soldOut: false, variants: [], addOnGroups: [] },
  { id: 'i16', categoryId: 'c5', name: 'Mango Lassi', description: 'Alphonso pulp, thick curd, a pinch of cardamom.', priceMinor: 16000, veg: 'veg', tags: [], spice: 0, soldOut: true, variants: [], addOnGroups: [] },
];

const CATS = [
  { id: 'c1', name: 'Starters', description: 'From the tandoor, to share.' },
  { id: 'c2', name: 'Mains', description: 'Slow gravies, dum and thali.' },
  { id: 'c3', name: 'Breads & Rice' },
  { id: 'c4', name: 'Desserts', description: 'Warm, cold, sweet.' },
  { id: 'c5', name: 'Beverages' },
];

const TAX_RATE = 0.05;

interface MockOrder extends StateOrder { createdMs: number; cancelled?: boolean }

export function createMockApi(opts: MockOptions): MenuApi {
  const speed = opts.fast ? 0.2 : 1;
  const delay = (ms = 120) => new Promise<void>((r) => setTimeout(r, ms + opts.slowMs));
  const listeners = new Set<StreamHandlers>();
  const emit = (name: StreamEventName, data: unknown = {}) => listeners.forEach((l) => l.onEvent(name, data));
  const orders: MockOrder[] = [];
  let waiterOpen = false;
  let paid = 0;
  const etagN = 1;
  const guest: GuestSession = { guestToken: 'mock-guest-token' };

  const payload = (): MenuPayload => ({
    business: {
      name: 'Kesar Terrace',
      slug: 'kesar-terrace',
      tagline: 'Wood-fired Indian dining, Visnagar',
      logoUrl: null,
      coverUrl: `${P}rooftop-restaurant-dusk.webp`,
      accentColor: null,
      currency: 'INR',
    },
    table: { label: 'Table 12', areaName: 'Rooftop', open: opts.mode !== 'closed' },
    settings: { ordering: opts.mode === 'off' || opts.mode === 'closed' ? 'off' : opts.mode, callWaiter: true, payment: { upi: true } },
    categories: CATS,
    items: ITEMS,
    etag: `W/"mock-${etagN}"`,
    serverTime: new Date().toISOString(),
  });

  const find = (id: string) => ITEMS.find((i) => i.id === id);

  const bill = (): BillState => {
    const live = orders.filter((o) => !o.cancelled);
    const subtotal = live.reduce((s, o) => s + (o.totalMinor ?? 0), 0);
    const half = Math.round((subtotal * TAX_RATE) / 2);
    const total = subtotal + half * 2;
    return {
      subtotalMinor: subtotal,
      taxLines: subtotal ? [{ name: 'CGST 2.5%', amountMinor: half }, { name: 'SGST 2.5%', amountMinor: half }] : [],
      totalMinor: total,
      paidMinor: paid,
      dueMinor: Math.max(0, total - paid),
      status: total > 0 && paid >= total ? 'PAID' : 'OPEN',
    };
  };

  const setStatus = (o: MockOrder, status: string) => {
    if (o.cancelled) return;
    o.status = status;
    o.timeline = [...(o.timeline ?? []), { status, at: new Date().toISOString() }];
    emit('order.updated', { orderId: o.id, status });
    emit('bill.updated', {});
  };

  const script = (o: MockOrder, confirmed: boolean) => {
    const steps: Array<[number, string]> = confirmed
      ? [[6000, 'PREPARING'], [16000, 'READY'], [26000, 'SERVED']]
      : [[5000, 'CONFIRMED'], [11000, 'PREPARING'], [21000, 'READY'], [31000, 'SERVED']];
    for (const [ms, st] of steps) setTimeout(() => setStatus(o, st), ms * speed);
  };

  return {
    mock: true,
    async getMenu(etag) {
      await delay();
      if (opts.offline) throw new ApiError('network', 0, 'No connection.');
      const p = payload();
      if (etag && etag === p.etag) return { status: 'not-modified' };
      return { status: 'ok', data: p };
    },
    async createGuest() {
      await delay(60);
      if (opts.mode === 'closed') throw new ApiError('conflict', 409, 'This table is not open yet.');
      return guest;
    },
    async getState(): Promise<TableState> {
      await delay(60);
      return {
        orders: orders.map(({ createdMs: _c, cancelled: _x, ...o }) => ({ ...o })),
        bill: orders.length ? bill() : null,
        waiterCall: { open: waiterOpen },
      };
    },
    async placeOrder(_g, body: PlaceOrderBody, key) {
      await delay(500);
      if (opts.mode === 'off' || opts.mode === 'closed') throw new ApiError('disabled', 403, 'Ordering from the table is switched off.');
      const dup = orders.find((o) => o.id === `mock-${key}`);
      if (dup) return { orderId: dup.id, status: dup.status, totalMinor: dup.totalMinor ?? 0 };
      let total = 0;
      const lines = body.lines.map((l) => {
        const item = find(l.itemId);
        if (!item) throw new ApiError('invalid', 422, 'An item is no longer on the menu.');
        if (item.soldOut) throw new ApiError('conflict', 409, `${item.name} is sold out.`);
        const variant = item.variants.find((v) => v.id === l.variantId);
        const adds = item.addOnGroups.flatMap((g) => g.options).filter((o) => l.addOnOptionIds?.includes(o.id));
        const unit = (variant?.priceMinor ?? item.priceMinor) + adds.reduce((s, a) => s + a.priceMinor, 0);
        total += unit * l.qty;
        return { itemId: item.id, name: item.name, qty: l.qty, variantName: variant?.name ?? null, addOns: adds.map((a) => a.name), note: l.note ?? null, lineTotalMinor: unit * l.qty };
      });
      const confirmed = opts.mode === 'auto';
      const status = confirmed ? 'CONFIRMED' : 'AWAITING_CONFIRMATION';
      const o: MockOrder = {
        id: `mock-${key}`, status, lines, placedAt: new Date().toISOString(), note: body.note ?? null, totalMinor: total,
        timeline: [{ status, at: new Date().toISOString() }], createdMs: Date.now(),
      };
      orders.push(o);
      script(o, confirmed);
      emit('order.updated', { orderId: o.id, status });
      emit('bill.updated', {});
      return { orderId: o.id, status, totalMinor: total };
    },
    async callWaiter(_g, _reason: WaiterReason) {
      await delay(200);
      waiterOpen = true;
      emit('waiter.ack', { open: true });
      setTimeout(() => {
        waiterOpen = false;
        emit('waiter.ack', { open: false });
      }, 20000 * speed);
    },
    async payIntent(): Promise<PayIntent> {
      await delay(250);
      const b = bill();
      const ref = 'KT-0412-7';
      // Mock only: pretend the waiter records the payment shortly after the QR was shown.
      setTimeout(() => {
        paid = bill().totalMinor;
        emit('bill.updated', {});
      }, 18000 * speed);
      const am = (b.dueMinor / 100).toFixed(2);
      return { upiUri: `upi://pay?pa=kesarterrace@upi&pn=Kesar%20Terrace&am=${am}&cu=INR&tn=${ref}`, amountMinor: b.dueMinor, reference: ref };
    },
    openStream(h) {
      listeners.add(h);
      const t = setTimeout(() => h.onOpen(), 250);
      return () => {
        clearTimeout(t);
        listeners.delete(h);
      };
    },
  };
}
