/**
 * Copy for the first-run tour ("Manhar Bot"). Three languages, kept in code (not the i18n JSON) because
 * the visitor picks the tour language independently of the app language, and the first question is
 * shown in all three at once.
 */
export const TOUR_LANGS = ['en', 'hi', 'gu'] as const;
export type TourLang = (typeof TOUR_LANGS)[number];

export const LANG_LABEL: Record<TourLang, string> = {
  en: 'English',
  hi: 'हिन्दी',
  gu: 'ગુજરાતી',
};

export interface TourStrings {
  /** Fixed UI words. */
  ui: {
    next: string;
    back: string;
    skip: string;
    done: string;
    stepOf: (n: number, total: number) => string;
    changeLanguage: string;
    close: string;
  };
  welcome: { title: (name: string) => string; body: string };
  finish: { title: string; body: string };
}

export const STRINGS: Record<TourLang, TourStrings> = {
  en: {
    ui: {
      next: 'Next',
      back: 'Back',
      skip: 'Skip tour',
      done: 'Start using Nexus',
      stepOf: (n, total) => `Step ${n} of ${total}`,
      changeLanguage: 'Change language',
      close: 'Close tour',
    },
    welcome: {
      title: (name) => (name ? `Hi ${name}, I’m Manhar Bot!` : 'Hi, I’m Manhar Bot!'),
      body: 'I’ll show you around in about a minute. Look at the menu on the left. I’ll light up each part as we go.',
    },
    finish: {
      title: 'You’re all set!',
      body: 'That’s the tour. Press ? any time to see shortcuts, or use “Take the tour” at the bottom of the menu to see me again.',
    },
  },
  hi: {
    ui: {
      next: 'आगे',
      back: 'पीछे',
      skip: 'टूर छोड़ें',
      done: 'Nexus इस्तेमाल करें',
      stepOf: (n, total) => `चरण ${n} / ${total}`,
      changeLanguage: 'भाषा बदलें',
      close: 'टूर बंद करें',
    },
    welcome: {
      title: (name) => (name ? `नमस्ते ${name}, मैं मनहर बॉट हूँ!` : 'नमस्ते, मैं मनहर बॉट हूँ!'),
      body: 'मैं आपको करीब एक मिनट में पूरा घुमा दूँगा। बाईं ओर का मेन्यू देखिए, मैं हर हिस्से को चमकाकर बताऊँगा।',
    },
    finish: {
      title: 'सब तैयार है!',
      body: 'टूर पूरा हुआ। शॉर्टकट देखने के लिए कभी भी ? दबाइए, या मुझे दोबारा देखने के लिए मेन्यू के नीचे “टूर देखें” दबाइए।',
    },
  },
  gu: {
    ui: {
      next: 'આગળ',
      back: 'પાછળ',
      skip: 'ટૂર છોડો',
      done: 'Nexus વાપરવાનું શરૂ કરો',
      stepOf: (n, total) => `પગલું ${n} / ${total}`,
      changeLanguage: 'ભાષા બદલો',
      close: 'ટૂર બંધ કરો',
    },
    welcome: {
      title: (name) => (name ? `નમસ્તે ${name}, હું મનહર બોટ છું!` : 'નમસ્તે, હું મનહર બોટ છું!'),
      body: 'હું તમને લગભગ એક મિનિટમાં બધું બતાવી દઈશ. ડાબી બાજુનું મેનુ જુઓ, હું દરેક ભાગ ચમકાવીને સમજાવીશ.',
    },
    finish: {
      title: 'બધું તૈયાર છે!',
      body: 'ટૂર પૂરી થઈ. શૉર્ટકટ જોવા માટે ગમે ત્યારે ? દબાવો, અથવા મને ફરી જોવા માટે મેનુની નીચે “ટૂર જુઓ” દબાવો.',
    },
  },
};

/** The question shown before a language is known: all three languages at once. */
export const ASK = {
  title: 'Manhar Bot',
  lines: {
    en: 'Would you like a quick tour of your dashboard?',
    hi: 'क्या आप अपने डैशबोर्ड का छोटा-सा टूर देखना चाहेंगे?',
    gu: 'શું તમે તમારા ડેશબોર્ડનો નાનકડો ટૂર જોવા માંગો છો?',
  } satisfies Record<TourLang, string>,
  yes: 'Yes · हाँ · હા',
  no: 'No thanks · नहीं · ના',
  later: 'Ask me later · बाद में · પછી પૂછો',
};

export const PICK_LANGUAGE = {
  lines: {
    en: 'Which language do you prefer?',
    hi: 'आप कौन-सी भाषा पसंद करेंगे?',
    gu: 'તમને કઈ ભાષા ગમશે?',
  } satisfies Record<TourLang, string>,
};

/** One stop on the tour: the sidebar page it lights up, with a title and a one-line explanation per language. */
export interface PageStep {
  /** Route path of the sidebar item to highlight (matches `PAGES[].path`). */
  path: string;
  copy: Record<TourLang, { title: string; body: string }>;
}

export const PAGE_STEPS: readonly PageStep[] = [
  {
    path: '/',
    copy: {
      en: { title: 'Home', body: 'Your day at a glance: sales so far, open tables and what needs attention.' },
      hi: { title: 'होम', body: 'आपका पूरा दिन एक नज़र में: अब तक की बिक्री, खुली टेबलें और ध्यान देने वाली बातें।' },
      gu: { title: 'હોમ', body: 'તમારો આખો દિવસ એક નજરમાં: અત્યાર સુધીનું વેચાણ, ખુલ્લા ટેબલ અને ધ્યાન આપવા જેવી બાબતો.' },
    },
  },
  {
    path: '/tables',
    copy: {
      en: { title: 'Tables & Sessions', body: 'Open a table, take orders and send them to the kitchen. This is where service happens.' },
      hi: { title: 'टेबल और सेशन', body: 'टेबल खोलिए, ऑर्डर लीजिए और किचन को भेजिए। सर्विस यहीं चलती है।' },
      gu: { title: 'ટેબલ અને સેશન', body: 'ટેબલ ખોલો, ઓર્ડર લો અને કિચનમાં મોકલો. સર્વિસ અહીં ચાલે છે.' },
    },
  },
  {
    path: '/guest-orders',
    copy: {
      en: { title: 'Guest orders', body: 'Orders customers place from the table QR land here. Approve them and they go to the kitchen.' },
      hi: { title: 'गेस्ट ऑर्डर', body: 'टेबल के QR से ग्राहक जो ऑर्डर देते हैं वो यहाँ आते हैं। मंज़ूर कीजिए, तो किचन में चले जाते हैं।' },
      gu: { title: 'ગેસ્ટ ઓર્ડર', body: 'ટેબલના QR પરથી ગ્રાહકો આપેલા ઓર્ડર અહીં આવે છે. મંજૂર કરો એટલે કિચનમાં જાય.' },
    },
  },
  {
    path: '/kitchen',
    copy: {
      en: { title: 'Kitchen Display', body: 'The kitchen sees every order here, in the order it arrived, and marks dishes ready.' },
      hi: { title: 'किचन डिस्प्ले', body: 'किचन को हर ऑर्डर यहाँ आने के क्रम में दिखता है, और वहाँ से डिश “तैयार” होती है।' },
      gu: { title: 'કિચન ડિસ્પ્લે', body: 'કિચનને દરેક ઓર્ડર અહીં આવ્યા મુજબ દેખાય છે, અને ત્યાંથી ડિશ “તૈયાર” થાય છે.' },
    },
  },
  {
    path: '/bills',
    copy: {
      en: { title: 'Bills', body: 'Every bill, with payments, refunds and the UPI QR for your customers to pay.' },
      hi: { title: 'बिल', body: 'हर बिल, पेमेंट, रिफंड और ग्राहक के भुगतान के लिए UPI QR यहाँ है।' },
      gu: { title: 'બિલ', body: 'દરેક બિલ, પેમેન્ટ, રિફંડ અને ગ્રાહકને ચૂકવવા માટે UPI QR અહીં છે.' },
    },
  },
  {
    path: '/menu',
    copy: {
      en: { title: 'Menu', body: 'Add dishes, prices, photos and add-ons. Customers see this menu when they scan your QR.' },
      hi: { title: 'मेन्यू', body: 'डिश, दाम, फोटो और ऐड-ऑन जोड़िए। QR स्कैन करने पर ग्राहक यही मेन्यू देखते हैं।' },
      gu: { title: 'મેનુ', body: 'ડિશ, ભાવ, ફોટો અને એડ-ઑન ઉમેરો. QR સ્કેન કરતાં ગ્રાહક આ જ મેનુ જુએ છે.' },
    },
  },
  {
    path: '/floor',
    copy: {
      en: { title: 'Floor setup', body: 'Create your areas and tables once. Everything else uses them.' },
      hi: { title: 'फ़्लोर सेटअप', body: 'अपने एरिया और टेबल एक बार बना लीजिए। बाकी सब इन्हीं का इस्तेमाल करता है।' },
      gu: { title: 'ફ્લોર સેટઅપ', body: 'તમારા એરિયા અને ટેબલ એક વાર બનાવી લો. બાકી બધું તેનો ઉપયોગ કરે છે.' },
    },
  },
  {
    path: '/qr',
    copy: {
      en: { title: 'Table QR codes', body: 'Print a QR for each table. Customers scan it to see your menu and order from their phone.' },
      hi: { title: 'टेबल QR कोड', body: 'हर टेबल के लिए QR प्रिंट कीजिए। ग्राहक स्कैन करके अपने फोन से मेन्यू देखते और ऑर्डर करते हैं।' },
      gu: { title: 'ટેબલ QR કોડ', body: 'દરેક ટેબલ માટે QR પ્રિન્ટ કરો. ગ્રાહક સ્કેન કરીને ફોનથી મેનુ જુએ અને ઓર્ડર કરે.' },
    },
  },
  {
    path: '/reports',
    copy: {
      en: { title: 'Reports', body: 'Sales, top dishes and payments by day. Know how your restaurant is really doing.' },
      hi: { title: 'रिपोर्ट', body: 'दिन के हिसाब से बिक्री, सबसे ज़्यादा बिकने वाली डिश और पेमेंट। जानिए रेस्टोरेंट असल में कैसा चल रहा है।' },
      gu: { title: 'રિપોર્ટ', body: 'દિવસ મુજબ વેચાણ, સૌથી વધુ વેચાતી ડિશ અને પેમેન્ટ. જાણો તમારી રેસ્ટોરન્ટ ખરેખર કેવી ચાલે છે.' },
    },
  },
  {
    path: '/costs',
    copy: {
      en: { title: 'Operating costs', body: 'Note rent, salaries and purchases here to see your real profit.' },
      hi: { title: 'ऑपरेटिंग खर्च', body: 'किराया, तनख्वाह और खरीदारी यहाँ लिखिए, ताकि असली मुनाफ़ा दिखे।' },
      gu: { title: 'ઑપરેટિંગ ખર્ચ', body: 'ભાડું, પગાર અને ખરીદી અહીં નોંધો, જેથી સાચો નફો દેખાય.' },
    },
  },
  {
    path: '/team',
    copy: {
      en: { title: 'Team', body: 'Add waiters, kitchen staff and cashiers. Each person only sees what their job needs.' },
      hi: { title: 'टीम', body: 'वेटर, किचन स्टाफ़ और कैशियर जोड़िए। हर व्यक्ति को सिर्फ़ उसके काम की चीज़ें दिखती हैं।' },
      gu: { title: 'ટીમ', body: 'વેઈટર, કિચન સ્ટાફ અને કેશિયર ઉમેરો. દરેકને ફક્ત તેના કામ જેટલું જ દેખાય છે.' },
    },
  },
  {
    path: '/profile',
    copy: {
      en: { title: 'Restaurant profile', body: 'Your name, logo, colour and address. They appear on bills and on your QR menu.' },
      hi: { title: 'रेस्टोरेंट प्रोफ़ाइल', body: 'आपका नाम, लोगो, रंग और पता। ये बिल और QR मेन्यू पर दिखते हैं।' },
      gu: { title: 'રેસ્ટોરન્ટ પ્રોફાઇલ', body: 'તમારું નામ, લોગો, રંગ અને સરનામું. આ બિલ અને QR મેનુ પર દેખાય છે.' },
    },
  },
  {
    path: '/config',
    copy: {
      en: { title: 'Configuration', body: 'Settings such as your UPI ID for payments and alerts. Set the UPI ID first so bills show a QR.' },
      hi: { title: 'कॉन्फ़िगरेशन', body: 'सेटिंग्स, जैसे पेमेंट के लिए आपकी UPI ID और अलर्ट। पहले UPI ID डालिए ताकि बिल पर QR दिखे।' },
      gu: { title: 'કૉન્ફિગરેશન', body: 'સેટિંગ્સ, જેમ કે પેમેન્ટ માટે તમારી UPI ID અને એલર્ટ. પહેલા UPI ID નાખો જેથી બિલ પર QR દેખાય.' },
    },
  },
  {
    path: '/modules',
    copy: {
      en: { title: 'Module Center', body: 'Turn features on or off for your restaurant.' },
      hi: { title: 'मॉड्यूल सेंटर', body: 'अपने रेस्टोरेंट के लिए फ़ीचर चालू या बंद कीजिए।' },
      gu: { title: 'મોડ્યુલ સેન્ટર', body: 'તમારી રેસ્ટોરન્ટ માટે ફીચર ચાલુ કે બંધ કરો.' },
    },
  },
  {
    path: '/activity',
    copy: {
      en: { title: 'Activity History', body: 'A log of who did what and when, for your peace of mind.' },
      hi: { title: 'गतिविधि इतिहास', body: 'किसने क्या और कब किया, इसका पूरा रिकॉर्ड।' },
      gu: { title: 'પ્રવૃત્તિ ઇતિહાસ', body: 'કોણે શું અને ક્યારે કર્યું તેનો પૂરો રેકૉર્ડ.' },
    },
  },
  {
    path: '/registrations',
    copy: {
      en: { title: 'Registrations', body: 'New restaurant requests from the website. Open one and create the account in one step.' },
      hi: { title: 'रजिस्ट्रेशन', body: 'वेबसाइट से आए नए रेस्टोरेंट के अनुरोध। एक खोलिए और एक ही क़दम में अकाउंट बना दीजिए।' },
      gu: { title: 'રજીસ્ટ્રેશન', body: 'વેબસાઇટ પરથી આવેલી નવી રેસ્ટોરન્ટની વિનંતીઓ. એક ખોલો અને એક જ પગલામાં એકાઉન્ટ બનાવો.' },
    },
  },
  {
    path: '/onboarding',
    copy: {
      en: { title: 'Onboarding', body: 'Track each new restaurant through its go-live checklist.' },
      hi: { title: 'ऑनबोर्डिंग', body: 'हर नए रेस्टोरेंट को गो-लाइव चेकलिस्ट से गुज़रते हुए ट्रैक कीजिए।' },
      gu: { title: 'ઑનબોર્ડિંગ', body: 'દરેક નવી રેસ્ટોરન્ટને ગો-લાઇવ ચેકલિસ્ટમાંથી પસાર થતી ટ્રૅક કરો.' },
    },
  },
  {
    path: '/commercial',
    copy: {
      en: { title: 'Commercial', body: 'Clients, plans and pricing.' },
      hi: { title: 'कमर्शियल', body: 'क्लाइंट, प्लान और कीमतें।' },
      gu: { title: 'કમર્શિયલ', body: 'ક્લાયન્ટ, પ્લાન અને કિંમતો.' },
    },
  },
];

/** Steps for the pages this user can actually see, in tour order. */
export function stepsFor(visiblePaths: readonly string[]): PageStep[] {
  const set = new Set(visiblePaths);
  return PAGE_STEPS.filter((s) => set.has(s.path));
}
