import { QR_MENU_LIVE } from './flags';
import type { ListItem, Post, PostBlock } from './types';

const p = (text: string): PostBlock => ({ type: 'p', text });
const h2 = (text: string): PostBlock => ({ type: 'h2', text });
const h3 = (text: string): PostBlock => ({ type: 'h3', text });
const ul = (...items: ListItem[]): PostBlock => ({ type: 'ul', items });
const ol = (...items: ListItem[]): PostBlock => ({ type: 'ol', items });
const lead = (leadText: string, text: string): ListItem => ({ lead: leadText, text });
const callout = (text: string, title?: string): PostBlock =>
  title ? { type: 'callout', title, text } : { type: 'callout', text };

const AUTHOR = 'Manhar Nexus team';
const PUBLISHED = '2026-10-31';
const path = (slug: string): string => `/insights/${slug}`;

/* ───────────────────────────── 1 ───────────────────────────── */

const wrongDish: Post = {
  slug: 'hidden-cost-of-order-mistakes',
  path: path('hidden-cost-of-order-mistakes'),
  title: 'The quiet cost of a wrong dish',
  dek: 'A mistake at Table 6 doesn’t cost the price of the dish. Here is what it actually costs — and where it starts.',
  category: 'OPERATIONS',
  readMinutes: 6,
  publishedAt: PUBLISHED,
  author: AUTHOR,
  cover: 'chef-hands-plating',
  seoTitle: 'The quiet cost of a wrong dish – Manhar Nexus Insights',
  seoDescription:
    'What a wrong or mis-heard order really costs a restaurant in food, labour, time and goodwill.',
  body: [
    p(
      'A guest at Table 6 asked for a half plate of paneer butter masala, less spicy. The kitchen sent out a full plate, medium. The guest is polite, says nothing, eats half, and does not come back for three months. What did that cost you?',
    ),
    p(
      'Most owners count the dish: perhaps ₹180 of food cost and a ₹320 menu price. That is the smallest number in the story.',
    ),
    h2('The real tally (an illustration, not a statistic)'),
    p(
      'Imagine the mistake is noticed and fixed. You pay for the first dish that gets thrown away or comped, which is the food cost. You pay a cook’s time to make the second dish, a few minutes of a busy station. You pay a waiter’s time to carry it, apologise and re-check the table. And you pay the delay that ripples to the other tickets waiting behind it. If it happens during rush, a six-minute delay on one table can push four other tables from “fine” to “annoyed”.',
    ),
    p(
      'Then there’s the part no register records: the guest’s trust. A regular who has once been served wrongly and ignored will quietly start choosing elsewhere. You never see this on a report. You only see a table that stopped booking.',
    ),
    h2('Where the mistake actually starts'),
    p(
      'Wrong dishes are rarely “kitchen mistakes”. They are hand-off mistakes. A request is spoken over noise. A modification is said once, to one person. A scribble is read under pressure. Every time information moves from one person’s head to another’s, it loses a little.',
    ),
    h2('Five practical ways to cut them'),
    ol(
      lead(
        'Make the options finite.',
        'If “less spicy”, “half plate” and “no onion” are real choices on your menu, define them as choices, so the waiter selects rather than types. Free-text notes are where mistakes breed.',
      ),
      lead(
        'Say it back.',
        'A waiter repeats the order to the guest in one sentence. Ten seconds that save a ten-minute apology.',
      ),
      lead(
        'Send it once, to one place.',
        'If the same request exists as a spoken instruction, a slip and a WhatsApp message, two of them will eventually disagree.',
      ),
      lead(
        'Show the kitchen what’s oldest.',
        'A mistaken dish often hides behind a backlog. When the oldest ticket is always visible, delays surface before guests complain.',
      ),
      lead(
        'Write down every remake.',
        'For two weeks, note each remake, the dish and the reason. Patterns show up quickly: one dish with a confusing name, one shift with a new waiter, one modifier nobody understands.',
      ),
    ),
    h2('What to do with the numbers'),
    p(
      'After a fortnight of noting remakes, look at three figures: how many, which dish, which hour. Most restaurants find that a handful of dishes and one or two busy hours cause most of the trouble. That is good news: it means the fix is a menu wording change or a rush-hour staffing tweak, not a restaurant-wide overhaul.',
    ),
    h2('Where software helps — and where it doesn’t'),
    p(
      'Software cannot cook or listen for you. What it can do is make the hand-off structured: the waiter picks the portion and the Add-ons, the Service Request carries exactly that to the Kitchen Operations Screen, and the kitchen sees what is oldest. It also keeps a record of what was asked, so when a disagreement happens you can check the request rather than argue about memory.',
    ),
    p(
      'If you take only one idea from this article, take this: a wrong dish is almost never a cooking problem. It is a message problem. Fix the message and the cooking mostly fixes itself.',
    ),
  ],
};

/* ───────────────────────────── 2 ───────────────────────────── */

const sevenNumbers: Post = {
  slug: 'seven-numbers-restaurant-owners-read-nightly',
  path: path('seven-numbers-restaurant-owners-read-nightly'),
  title: 'Seven numbers to read before you sleep',
  dek: 'You don’t need a hundred reports. You need these seven, in this order, every night.',
  category: 'NUMBERS',
  readMinutes: 7,
  publishedAt: PUBLISHED,
  author: AUTHOR,
  cover: 'closing-counter-lamp',
  seoTitle: 'Seven numbers to read before you sleep – Manhar Nexus Insights',
  seoDescription: 'The seven numbers an Indian restaurant owner should check every night.',
  body: [
    p(
      'Restaurant software can produce fifty reports. A tired owner at 11:45 pm will read perhaps three. So choose them well. Here are seven numbers worth reading every night, in a sensible order, and what each one is quietly telling you.',
    ),
    h3('1. Net sales today.'),
    p(
      'Total sales after refunds and Voids. This is the headline, but read it against something: the same weekday last week, not yesterday. Weekends and weekdays are different restaurants.',
    ),
    h3('2. Number of Guest Sessions (visits).'),
    p(
      'How many parties did you serve? Sales without visits is a half-story. If sales are flat but visits are down, your guests are spending more each — possibly good, possibly one big table distorting the day.',
    ),
    h3('3. Average bill per visit.'),
    p(
      'Net sales divided by visits. Watch it over weeks, not days. A slow rise often means your staff are suggesting well; a slow fall often means a popular cheap item is crowding out the rest.',
    ),
    h3('4. Payment mix: cash and UPI.'),
    p(
      'How much arrived as cash and how much as UPI. This matters for tomorrow morning’s drawer and for matching with your bank. A sudden shift can mean a payment-method habit changed — or something else did.',
    ),
    h3('5. Refunds and Voids: count and value.'),
    p(
      'This is the single most underrated number. A few, each with a clear reason, is normal. A rising count, or a pattern around one shift or one staff member, is a conversation waiting to happen. Insist that every refund has a reason written down.',
    ),
    h3('6. Cash variance.'),
    p(
      'What the drawer should contain versus what it does. One small mismatch happens. A repeating mismatch on the same shift is not an accident. Count the drawer at the same time every night, with the same two people.',
    ),
    h3('7. Top items and dead items.'),
    p(
      'Which dishes carried the day and which did not move. Over a month, this tells you what to promote, what to reprice and what to remove. A dish that never sells still costs you prep, storage and menu space.',
    ),
    h2('A simple routine'),
    p(
      'Read them in this order, in under five minutes: 1, 2, 3, then 5 and 6 together, then 4, then 7 once a week. Write one line for tomorrow: “Check refunds on the evening shift”, “Promote the thali on Tuesday”. A number without a next action is trivia.',
    ),
    h2('Two warnings'),
    p(
      'Don’t compare a festival day with an ordinary day. And don’t read your numbers from three different places. If sales come from the register, payments from a notebook and refunds from memory, you are not reading numbers; you are reading opinions.',
    ),
    h2('One source of truth'),
    p(
      'The nightly routine only works if all seven numbers come from the same place and cannot be quietly changed afterwards. That is the real reason to put the day on one system: not the dashboards, but the fact that the numbers agree with each other and with themselves tomorrow. Whatever you use, make it so that a paid bill can’t be edited and a refund always leaves a trail. Then your seven numbers stop being a debate and become a routine.',
    ),
  ],
};

/* ───────────────────────────── 3 ───────────────────────────── */

const theBill: Post = {
  slug: 'why-the-bill-is-your-most-important-document',
  path: path('why-the-bill-is-your-most-important-document'),
  title: 'Why the bill is the most important document in your restaurant',
  dek: 'It’s a tax record, a promise to the guest and the last word in an argument. Treat it that way.',
  category: 'CHECKOUT',
  readMinutes: 6,
  publishedAt: PUBLISHED,
  author: AUTHOR,
  cover: 'table-setting-topdown',
  seoTitle: 'Why the bill is your restaurant’s most important document – Manhar Nexus Insights',
  seoDescription: 'A bill is a tax record, a promise and evidence. What a good one contains.',
  body: [
    p(
      'Ask a restaurateur for the most important document in the building and you may hear “the licence”, or “the menu”. Look at what you hand to a guest at the end of every meal and you’ll see the real answer: the bill.',
    ),
    h2('It does four jobs at once'),
    ol(
      lead(
        'A promise to the guest.',
        'It says: this is what you ordered, this is what it costs, and this is the tax. If the numbers are wrong, trust leaves with the guest.',
      ),
      lead(
        'A tax record.',
        'In India, GST registrants have invoice obligations. The bill — properly numbered, with the right tax shown — is the record that your returns rest on. (General information; please confirm specifics with your CA.)',
      ),
      lead(
        'The base of your daily closing.',
        'Your cash count, your UPI matching, your sales report: all of them start with bills. If the bills are unreliable, everything downstream is guesswork.',
      ),
      lead(
        'Evidence.',
        'When a guest says “I was overcharged”, or a staff member says “I never gave that discount”, the bill and its history are the evidence.',
      ),
    ),
    h2('What a good bill contains'),
    ul(
      'A unique, sequential bill number that is never reused.',
      'The date and time, the table and the party.',
      'Each item with quantity, price and any portion or Add-on, exactly as ordered.',
      'Tax shown by rate, with the amounts adding up.',
      'The total, with rounding rules that are consistent.',
      'How it was paid, and for cash, the amount tendered and the change.',
      'Your restaurant’s name, address and, if you are registered, GSTIN.',
    ),
    h2('The most dangerous button: “edit bill”'),
    p(
      'Many tools let a bill be edited after it is paid. It feels flexible: the guest remembers a mistake, the owner fixes it. The problem is that the same flexibility lets anyone change history later, silently. Today’s honest fix becomes next month’s mystery shortfall.',
    ),
    p(
      'A better rule is the accountant’s rule: never erase, only reverse. If a paid bill was wrong, you don’t change it. You record a refund or a Void against it, with a reason and the name of the person who did it. The original stays. The correction sits beside it. Anyone looking later sees exactly what happened and why.',
    ),
    p(
      'This has a side effect owners like: it makes honest staff safer. If every correction leaves a trail, nobody can be blamed for something they didn’t do, and nobody can quietly do something they shouldn’t.',
    ),
    h2('Numbering matters more than it seems'),
    p(
      'Skipped or reused bill numbers are a classic audit question. “Why is number 1042 missing?” is easy to answer if a Void keeps the number used. It is hard to answer if bills can be deleted.',
    ),
    h2('A short checklist'),
    ul(
      'Can a paid bill be edited? It shouldn’t be.',
      'Does every refund need a reason? It should.',
      'Do voided numbers stay used? They should.',
      'Do your bill totals match your daily report to the rupee? They must.',
      'Can you find any bill from last month in under a minute? You should.',
    ),
    h2('In one line'),
    p(
      'A bill is not a printout. It is the point where a guest’s trust, your tax and your cash meet. Build your process around protecting it.',
    ),
  ],
};

/* ───────────────────────────── 4 ───────────────────────────── */

const qrOrdering: Post = {
  slug: 'qr-ordering-without-losing-the-human-touch',
  path: path('qr-ordering-without-losing-the-human-touch'),
  title: 'QR ordering without losing the human touch',
  dek: 'The scan menu is easy. Keeping the hospitality is the hard part.',
  category: 'GUEST EXPERIENCE',
  readMinutes: 6,
  publishedAt: PUBLISHED,
  author: AUTHOR,
  cover: 'qr-table-tent-blank',
  seoTitle: 'QR ordering without losing the human touch – Manhar Nexus Insights',
  seoDescription: 'How to use QR menus in a restaurant and keep the warmth of hospitality.',
  body: [
    p(
      'A QR code on the table can feel like a gift or a goodbye. Done well, it gives the guest a clearer menu, faster ordering and fewer misunderstandings. Done badly, it tells the guest that the restaurant would rather not talk to them.',
    ),
    p('The technology is easy. The hospitality is the hard part.'),
    h2('What QR ordering is genuinely good at'),
    ul(
      lead('Showing the real menu.', 'Photos, ingredients, portion sizes and what is actually available today.'),
      lead(
        'Reducing mishearing.',
        'The guest types or taps their own choice, so there’s no “did you say paneer or paneer tikka?”',
      ),
      lead(
        'Speeding up the quiet moments.',
        'A guest who wants another round of chai doesn’t have to wave for five minutes.',
      ),
      lead(
        'Serving different guests differently.',
        'Some people love to browse alone; QR gives them privacy.',
      ),
    ),
    h2('Where it quietly goes wrong'),
    ul(
      lead(
        'Slow phones and patchy data.',
        'A menu that takes forty seconds to load on a weak connection is worse than a printed card.',
      ),
      lead(
        'Older or less comfortable guests.',
        'Grandparents who are not comfortable with scanning feel excluded in their own family dinner.',
      ),
      lead(
        'No one comes.',
        'If ordering is entirely on the phone, the guest may sit for twenty minutes assuming someone has noticed them.',
      ),
      lead(
        'No place for the special request.',
        '“It’s my father’s birthday, can you bring a candle?” doesn’t fit in a dropdown.',
      ),
    ),
    h2('Five rules for keeping the human touch'),
    ol(
      lead(
        'Offer both.',
        'QR for those who want it, a waiter for those who don’t. Never make a guest feel they must use their phone.',
      ),
      lead(
        'Greet first.',
        'The waiter says hello, offers water and mentions the scan option. A thirty-second welcome changes the entire mood.',
      ),
      lead(
        'Make it a conversation starter, not a replacement.',
        '“Scan whenever you’re ready — and I’ll check on you in a few minutes.”',
      ),
      lead(
        'Keep a visible check-in.',
        'Whatever the system, a human visits each table at predictable moments: after the first dish, before dessert, at the bill.',
      ),
      lead(
        'Show availability honestly.',
        'If the paneer is finished, mark it Sold-Out so the guest never orders something you cannot serve. Nothing damages trust faster than “sorry, we don’t have that” after waiting fifteen minutes.',
      ),
    ),
    h2('Think about the kitchen too'),
    p(
      'A QR order that arrives with no structure — free text, no portion, no spice level — creates the same wrong-dish problem described in our article on order mistakes. The menu behind the QR should offer finite, clear choices.',
    ),
    h2('A word on payment'),
    p(
      'Many guests are happy to pay by UPI at the table, but some still want a printed bill and a human to say thank you. Keep the exit as warm as the entrance.',
    ),
    h2('Where Nexus stands'),
    p(
      QR_MENU_LIVE
        ? 'Nexus Menu follows these principles: guest orders wait for your waiter’s confirmation (unless you choose otherwise), your staff confirm every payment, prices are recalculated on the server and sold-out dishes can’t be ordered. The principles above apply to any QR system you adopt, from any vendor.'
        : 'Nexus’s QR Scan Menu is on our roadmap and isn’t available yet; we’d rather say so than sell it early. The principles above apply to any QR system you adopt, from any vendor.',
    ),
    h2('The test'),
    p(
      'Imagine your most elderly regular and your most phone-fluent student arriving together. If both feel looked after, your QR ordering is working.',
    ),
  ],
};

/* ───────────────────────────── 5 ───────────────────────────── */

const ticketPsychology: Post = {
  slug: 'kitchen-ticket-psychology',
  path: path('kitchen-ticket-psychology'),
  title: 'Kitchen ticket psychology',
  dek: 'Why the oldest ticket should shout the loudest — and what a calm kitchen looks like.',
  category: 'KITCHEN',
  readMinutes: 6,
  publishedAt: PUBLISHED,
  author: AUTHOR,
  cover: 'kitchen-pass-ticket-rail',
  seoTitle: 'Kitchen ticket psychology – Manhar Nexus Insights',
  seoDescription:
    'Why the oldest kitchen ticket should be the most visible and how to run a calmer kitchen.',
  body: [
    p(
      'Watch a busy kitchen at 8:40 on a Saturday and you’ll see something that isn’t about cooking. It’s about attention. A cook looks up at a row of tickets and decides, in half a second, what to do next. That decision, repeated two hundred times a night, shapes how the evening feels for every guest.',
    ),
    h2('What cooks actually respond to'),
    p(
      'People don’t read queues. They respond to what is loudest, newest and closest. A new ticket arrives with a beep and feels urgent. An older ticket slides left and becomes wallpaper. A table that sent a waiter to the pass twice gets cooked first, whether or not it ordered first.',
    ),
    p(
      'None of this is a character flaw. It is how human attention works. The fix is not telling cooks to “pay attention” but designing the queue so that the right thing is also the loudest thing.',
    ),
    h2('Five principles of a calm ticket system'),
    ol(
      lead(
        'Oldest first, always visible.',
        'The ticket that has waited longest should be the most prominent. Newness shouldn’t win attention.',
      ),
      lead(
        'Show the wait, not just the order.',
        'A ticket that says “14 min” tells the story. A ticket that merely exists doesn’t.',
      ),
      lead(
        'Mark lateness quietly but clearly.',
        'A small, consistent flag when a ticket passes your standard time. Avoid alarms that blare for everything; people tune them out.',
      ),
      lead(
        'One owner per state.',
        'Each ticket should be accepted, started and marked ready by a named person or station, so “who has this?” is never a question.',
      ),
      lead(
        'Keep modifications on the ticket, not in the air.',
        '“Less spicy” should be printed or displayed where the cook is looking, not shouted across the pass.',
      ),
    ),
    h2('Why waiting time matters to guests'),
    p(
      'Guests don’t measure minutes; they measure uncertainty. A dish that takes twenty minutes and was promised in twenty is fine. A dish that takes twelve but was promised in ten feels late. The kitchen’s job is not only to be fast but to be predictable, and a visible queue is what makes prediction possible.',
    ),
    h2('The pass is a decision point'),
    p(
      'Everything leaving the kitchen should pass a final look: right table, right dish, right modification, right temperature. A single glance at the pass catches mistakes cheaply. After the food reaches the table, they cost far more.',
    ),
    h2('Common traps'),
    ul(
      lead('Printing too much.', 'Tickets full of unrelated information make cooks stop reading.'),
      lead(
        'No end state.',
        'If nobody marks a dish ready, the floor keeps asking and the kitchen keeps answering. Interruptions are the hidden tax on a busy station.',
      ),
      lead(
        'Treating rush as normal.',
        'If every Saturday looks like chaos, the problem is capacity or process, not “a busy night”.',
      ),
    ),
    h2('A tiny experiment'),
    p(
      'For one week, write down the longest wait each evening and which table it was. If it’s always the same type of dish or the same station, you’ve found your bottleneck without any software at all.',
    ),
    h2('Where tools help'),
    p(
      'A good kitchen screen does these things quietly: oldest-first order, visible waiting time, a late flag, and clear states from accepted to ready. It doesn’t make anyone cook faster. It makes the right ticket the loudest ticket — and that is most of what a calm kitchen is.',
    ),
  ],
};

/* ───────────────────────────── 6 ───────────────────────────── */

const gstMistakes: Post = {
  slug: 'gst-invoicing-mistakes-restaurants',
  path: path('gst-invoicing-mistakes-restaurants'),
  title: 'GST invoicing mistakes restaurants make',
  dek: 'Eight slips that cause headaches at filing time, and how to spot them early. General information.',
  category: 'COMPLIANCE',
  readMinutes: 7,
  publishedAt: PUBLISHED,
  author: AUTHOR,
  cover: 'owner-tablet-reports',
  seoTitle: 'GST invoicing mistakes restaurants make – Manhar Nexus Insights',
  seoDescription: 'Eight common GST invoicing slips in restaurants. General information only.',
  body: [
    callout(
      'GST rules, rates and thresholds change and depend on your type of establishment and registration. Please confirm everything with a qualified Chartered Accountant or tax professional.',
      'General information, not tax or legal advice.',
    ),
    p(
      'GST problems in restaurants rarely come from dramatic fraud. They come from small, repeated slips that nobody notices until filing time, or until a notice arrives. Here are eight to watch for.',
    ),
    h3('1. Charging tax you are not entitled to charge.'),
    p(
      'Whether and how a restaurant may collect GST depends on its registration and scheme. For example, a business under the composition scheme generally cannot collect GST from guests as a separate tax on its bills. Know which category you are in, and make sure your bills follow it.',
    ),
    h3('2. Showing the wrong rate.'),
    p(
      'Rates differ by type of establishment and service, and they can be revised. A rate set once in your system and never reviewed can quietly go wrong. Review your tax categories each time you change your menu structure and at least once a year.',
    ),
    h3('3. Treating service charge casually.'),
    p(
      'Service charge and tips are treated differently in practice, and the tax treatment of service charge is a topic where owners often get conflicting advice. Decide with your CA how it should appear on bills, and keep it consistent.',
    ),
    h3('4. Editing bills after they are issued.'),
    p(
      'A bill that can be changed after payment is a bill you can’t fully defend. If a correction is genuinely needed, record it as a separate credit or reversal with a reason, rather than overwriting the original.',
    ),
    h3('5. Gaps and duplicates in bill numbers.'),
    p(
      'Invoice numbers should follow a consistent, unique series. Skipped or repeated numbers invite questions. If a bill is cancelled, the number should still be accounted for rather than disappearing.',
    ),
    h3('6. Missing or wrong details.'),
    p(
      'A proper tax invoice carries specific details such as your name and address, GSTIN where registered, the date, the invoice number and the tax breakdown. When a business guest asks for a GST invoice, you need their details recorded correctly at the time, not reconstructed later.',
    ),
    h3('7. Inconsistent rounding.'),
    p(
      'Rounding each line differently from the total produces mismatches between the bill, the report and the return. Pick one rounding method and apply it everywhere, so a bill total can always be recomputed from its lines.',
    ),
    h3('8. Mismatch between sales records and returns.'),
    p(
      'If your daily sales are kept in one place, payments in another, and returns prepared from a third, small differences multiply. Reconcile your daily sales report against the tax figures each month, before filing.',
    ),
    h2('A simple monthly check'),
    ul(
      'Pick five bills at random and recompute the tax by hand.',
      'Check that the bill series has no unexplained gaps.',
      'Compare monthly sales by tax rate against what you will report.',
      'List every refund and Void, with its reason.',
      'Send the reports to your CA early, not on the last day.',
    ),
    h2('What software can and can’t do'),
    p(
      'Good software calculates tax consistently, shows it by rate, never lets a paid bill be rewritten and keeps a reason with every correction. That removes a lot of the small slips above. It doesn’t decide your rates or file your return — those remain decisions for you and your CA. Nexus, for instance, calculates GST per line and groups it by rate in reports, but does not file returns or generate e-invoices.',
    ),
    h2('The takeaway'),
    p(
      'Most GST pain is not about knowing a secret rule. It is about consistency: the same rate, the same rounding, the same numbering and the same honesty with corrections, every day. Build the habit, and filing becomes an afternoon rather than an ordeal.',
    ),
  ],
};

/** The six Insights articles, in display order. */
export const POSTS: readonly Post[] = [
  wrongDish,
  sevenNumbers,
  theBill,
  qrOrdering,
  ticketPsychology,
  gstMistakes,
];

export const INSIGHTS_HEADER = {
  eyebrow: 'INSIGHTS',
  headline: {
    text: 'Notes from the pass.',
    accent: 'pass',
  },
  subhead: 'Plain-language reading for restaurant owners. No jargon, no hype.',
  readLabel: 'min read',
  backLabel: '← All insights',
  generalInfoNote: 'General information, not tax or legal advice.',
} as const;

/** The three articles featured on the home page (the other three stay one link away, and all six have their own routes). */
export const FEATURED_POST_SLUGS: readonly string[] = [
  'qr-ordering-without-losing-the-human-touch',
  'seven-numbers-restaurant-owners-read-nightly',
  'hidden-cost-of-order-mistakes',
];

export function getPost(slug: string): Post | undefined {
  return POSTS.find((post) => post.slug === slug);
}

/** Two other articles to suggest at the end of a post. */
export function relatedPosts(slug: string, count = 2): readonly Post[] {
  return POSTS.filter((post) => post.slug !== slug).slice(0, count);
}
