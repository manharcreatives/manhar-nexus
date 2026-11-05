import type { BotMood } from '../../../tour/TourBotFace';
import type { TourLang } from '../../../tour/content';
import type { RegistrationFieldName } from '../../content';
import type { BuddyEvent } from './store';

/** What Manhar Bot says and how it feels about one event. */
export interface Reaction {
  mood: BotMood;
  text: string;
}

type L<T> = Record<TourLang, T>;

const WELCOME: L<string> = {
  en: 'Hi! I’m Manhar Bot. I’ll help you fill this in. Two minutes, promise.',
  hi: 'नमस्ते! मैं मनहर बॉट हूँ। मैं आपको ये फ़ॉर्म भरने में मदद करूँगा। बस दो मिनट!',
  gu: 'નમસ્તે! હું મનહર બોટ છું. આ ફોર્મ ભરવામાં હું તમને મદદ કરીશ. બસ બે મિનિટ!',
};

const NUDGE: L<string> = {
  en: 'Stuck? Tap WhatsApp on the side and a real person will help you.',
  hi: 'अटक गए? बगल में WhatsApp दबाइए, एक असली इंसान आपकी मदद करेगा।',
  gu: 'અટકી ગયા? બાજુમાં WhatsApp દબાવો, એક સાચો માણસ તમને મદદ કરશે.',
};

/** What each field is for, said when the visitor clicks into it. */
const FOCUS: Partial<Record<RegistrationFieldName, L<string>>> = {
  restaurantName: {
    en: 'What’s your restaurant called? The name your guests know.',
    hi: 'आपके रेस्टोरेंट का नाम क्या है? वही जो ग्राहक जानते हैं।',
    gu: 'તમારી રેસ્ટોરન્ટનું નામ શું છે? જે નામથી ગ્રાહકો તમને ઓળખે છે.',
  },
  contactName: {
    en: 'Who should we talk to? Just your name is fine.',
    hi: 'हम किससे बात करें? बस आपका नाम काफ़ी है।',
    gu: 'અમે કોની સાથે વાત કરીએ? ફક્ત તમારું નામ પૂરતું છે.',
  },
  phone: {
    en: 'Your 10-digit mobile number. We’ll message you on WhatsApp.',
    hi: 'आपका 10 अंकों का मोबाइल नंबर। हम आपको WhatsApp पर मैसेज करेंगे।',
    gu: 'તમારો 10 આંકડાનો મોબાઇલ નંબર. અમે તમને WhatsApp પર મેસેજ કરીશું.',
  },
  email: {
    en: 'Your email. Your payment link and invoice will come here.',
    hi: 'आपका ईमेल। पेमेंट लिंक और इनवॉइस यहीं आएगा।',
    gu: 'તમારો ઈમેલ. પેમેન્ટ લિંક અને ઇન્વૉઇસ અહીં આવશે.',
  },
  city: {
    en: 'Which city is your restaurant in?',
    hi: 'आपका रेस्टोरेंट किस शहर में है?',
    gu: 'તમારી રેસ્ટોરન્ટ કયા શહેરમાં છે?',
  },
  businessKind: {
    en: 'Pick the closest match. Not sure? “Other” is fine.',
    hi: 'सबसे मिलता-जुलता चुनिए। पक्का नहीं? “Other” चलेगा।',
    gu: 'સૌથી નજીકનું પસંદ કરો. ખાતરી નથી? “Other” ચાલશે.',
  },
  outlets: {
    en: 'How many outlets do you run? Just one? Perfect.',
    hi: 'आपके कितने आउटलेट हैं? सिर्फ़ एक? बढ़िया।',
    gu: 'તમારા કેટલા આઉટલેટ છે? ફક્ત એક? સરસ.',
  },
  message: {
    en: 'Optional! Tell me about your printers, menu size, or any question.',
    hi: 'ये वैकल्पिक है! प्रिंटर, मेन्यू का साइज़ या कोई सवाल बता सकते हैं।',
    gu: 'આ વૈકલ્પિક છે! પ્રિન્ટર, મેનુનું કદ કે કોઈ પ્રશ્ન જણાવી શકો.',
  },
  consent: {
    en: 'Last step: tick this so we can contact you and set things up.',
    hi: 'आख़िरी कदम: इसे टिक कीजिए ताकि हम आपसे संपर्क कर सकें।',
    gu: 'છેલ્લું પગલું: આને ટિક કરો જેથી અમે તમારો સંપર્ક કરી શકીએ.',
  },
};

/** A short cheer when a field is accepted. Rotated so it does not repeat the same word. */
const VALID: L<readonly string[]> = {
  en: ['Nice!', 'Looks good!', 'Perfect!', 'Got it!'],
  hi: ['बढ़िया!', 'एकदम सही!', 'ये हुआ!', 'मिल गया!'],
  gu: ['સરસ!', 'એકદમ બરાબર!', 'થઈ ગયું!', 'મળી ગયું!'],
};

/** Gentle, specific help when a field is rejected. */
const INVALID: Partial<Record<RegistrationFieldName, L<string>>> & { default: L<string> } = {
  phone: {
    en: 'Hmm, that isn’t a 10-digit mobile number. It starts with 6, 7, 8 or 9.',
    hi: 'हम्म, ये 10 अंकों का मोबाइल नंबर नहीं लग रहा। ये 6, 7, 8 या 9 से शुरू होता है।',
    gu: 'હમ્મ, આ 10 આંકડાનો મોબાઇલ નંબર નથી લાગતો. તે 6, 7, 8 કે 9 થી શરૂ થાય છે.',
  },
  email: {
    en: 'That email looks off. Maybe a missing @ or .com?',
    hi: 'ये ईमेल सही नहीं लग रहा। शायद @ या .com छूट गया?',
    gu: 'આ ઈમેલ બરાબર નથી લાગતો. કદાચ @ કે .com રહી ગયું?',
  },
  outlets: {
    en: 'Just a number from 1 to 500, please.',
    hi: 'बस 1 से 500 के बीच की एक संख्या डालिए।',
    gu: 'બસ 1 થી 500 વચ્ચેનો એક આંકડો નાખો.',
  },
  consent: {
    en: 'Please tick the box so we can go ahead.',
    hi: 'आगे बढ़ने के लिए कृपया बॉक्स टिक कीजिए।',
    gu: 'આગળ વધવા માટે કૃપા કરીને બૉક્સ ટિક કરો.',
  },
  default: {
    en: 'I need this one to continue. Take your time!',
    hi: 'आगे बढ़ने के लिए मुझे ये चाहिए। आराम से!',
    gu: 'આગળ વધવા માટે મને આ જોઈએ. આરામથી!',
  },
};

const CONSENT_ON: L<string> = {
  en: 'Thank you! Now press “Send my request”.',
  hi: 'धन्यवाद! अब “Send my request” दबाइए।',
  gu: 'આભાર! હવે “Send my request” દબાવો.',
};

/** The opening line: greets and names the first field. */
const ASK_FIRST: L<string> = {
  en: 'Hi, I’m Manhar Bot! I’ll guide you. Let’s start: what’s your restaurant called?',
  hi: 'नमस्ते, मैं मनहर बॉट हूँ! मैं आपको रास्ता दिखाऊँगा। शुरू करते हैं: आपके रेस्टोरेंट का नाम क्या है?',
  gu: 'નમસ્તે, હું મનહર બોટ છું! હું તમને માર્ગ બતાવીશ. ચાલો શરૂ કરીએ: તમારી રેસ્ટોરન્ટનું નામ શું છે?',
};

/** "Now fill this": the bot leads to the next empty field. */
const ASK_NEXT: Partial<Record<RegistrationFieldName, L<string>>> = {
  restaurantName: ASK_FIRST,
  contactName: {
    en: 'Now your name, please.',
    hi: 'अब आपका नाम, कृपया।',
    gu: 'હવે તમારું નામ, કૃપા કરીને.',
  },
  phone: {
    en: 'Next: your 10-digit mobile number.',
    hi: 'अगला: आपका 10 अंकों का मोबाइल नंबर।',
    gu: 'આગળ: તમારો 10 આંકડાનો મોબાઇલ નંબર.',
  },
  email: {
    en: 'Now your email, for the payment link.',
    hi: 'अब आपका ईमेल, पेमेंट लिंक के लिए।',
    gu: 'હવે તમારો ઈમેલ, પેમેન્ટ લિંક માટે.',
  },
  city: {
    en: 'Which city is the restaurant in?',
    hi: 'रेस्टोरेंट किस शहर में है?',
    gu: 'રેસ્ટોરન્ટ કયા શહેરમાં છે?',
  },
  outlets: {
    en: 'How many outlets do you have? A number is enough.',
    hi: 'आपके कितने आउटलेट हैं? बस एक संख्या।',
    gu: 'તમારા કેટલા આઉટલેટ છે? બસ એક આંકડો.',
  },
  consent: {
    en: 'Almost done! Tick the box to agree, then we can send it.',
    hi: 'लगभग हो गया! सहमति के लिए बॉक्स टिक कीजिए, फिर हम भेज देंगे।',
    gu: 'લગભગ થઈ ગયું! સંમતિ માટે બૉક્સ ટિક કરો, પછી અમે મોકલી દઈશું.',
  },
};

/** A patient reminder when the visitor has gone quiet on the field the bot asked for. */
const ASK_AGAIN: L<(what: string) => string> = {
  en: (what) => `Still here! ${what}`,
  hi: (what) => `मैं यहीं हूँ! ${what}`,
  gu: (what) => `હું અહીં જ છું! ${what}`,
};

const READY: L<string> = {
  en: 'All set! Press “Send my request” and you’ll get your reference.',
  hi: 'सब तैयार! “Send my request” दबाइए, आपको रेफ़रेंस मिल जाएगा।',
  gu: 'બધું તૈયાર! “Send my request” દબાવો, તમને રેફરન્સ મળશે.',
};

const SUBMIT: L<string> = {
  en: 'Sending it now… fingers crossed!',
  hi: 'अभी भेज रहा हूँ… उँगलियाँ क्रॉस!',
  gu: 'હમણાં મોકલું છું… આંગળીઓ ક્રૉસ!',
};

const SUCCESS = (ref: string): L<string> => ({
  en: `Done! Your reference is ${ref}. Keep it handy. We’ll message you within one working day.`,
  hi: `हो गया! आपका रेफ़रेंस ${ref} है। इसे संभालकर रखिए। हम एक कार्य-दिवस में आपको मैसेज करेंगे।`,
  gu: `થઈ ગયું! તમારો રેફરન્સ ${ref} છે. તેને સાચવી રાખો. અમે એક કામકાજી દિવસમાં મેસેજ કરીશું.`,
});

const FAILURE: Record<'rate-limit' | 'network' | 'server' | 'validation', L<string>> = {
  'rate-limit': {
    en: 'Lots of requests from your network. Wait a little, or WhatsApp us.',
    hi: 'आपके नेटवर्क से कई अनुरोध आ गए। थोड़ा रुकिए, या हमें WhatsApp कीजिए।',
    gu: 'તમારા નેટવર્કથી ઘણી વિનંતીઓ આવી. થોડું રાહ જુઓ, અથવા અમને WhatsApp કરો.',
  },
  network: {
    en: 'I couldn’t reach the server. Check your internet and try again.',
    hi: 'मैं सर्वर तक नहीं पहुँच पाया। इंटरनेट देखिए और फिर कोशिश कीजिए।',
    gu: 'હું સર્વર સુધી પહોંચી ન શક્યો. ઇન્ટરનેટ તપાસો અને ફરી પ્રયત્ન કરો.',
  },
  server: {
    en: 'Oh no, something went wrong on our side. Try again, or WhatsApp us.',
    hi: 'ओह, हमारी तरफ़ कुछ गड़बड़ हो गई। फिर कोशिश कीजिए, या WhatsApp कीजिए।',
    gu: 'અરે, અમારી બાજુ કંઈક ગડબડ થઈ. ફરી પ્રયત્ન કરો, અથવા WhatsApp કરો.',
  },
  validation: {
    en: 'Some details need a second look. I’ve marked them for you.',
    hi: 'कुछ जानकारी दोबारा देखनी होगी। मैंने उन्हें चिह्नित कर दिया है।',
    gu: 'કેટલીક વિગતો ફરી જોવી પડશે. મેં તેમને ચિહ્નિત કરી છે.',
  },
};

const PHONE_PROGRESS = (n: number): L<string> => ({
  en: n === 0 ? 'Type your 10 digits. I’ll count along.' : `${n} of 10 digits. Keep going!`,
  hi: n === 0 ? '10 अंक डालिए, मैं गिनता रहूँगा।' : `10 में से ${n} अंक। चलते रहिए!`,
  gu: n === 0 ? '10 આંકડા લખો, હું ગણતો રહીશ.' : `10 માંથી ${n} આંકડા. ચાલુ રાખો!`,
});
const PHONE_OK: L<string> = {
  en: 'That’s a proper mobile number. Lovely!',
  hi: 'ये बिल्कुल सही मोबाइल नंबर है। वाह!',
  gu: 'આ એકદમ સાચો મોબાઇલ નંબર છે. વાહ!',
};
const PHONE_TOO_LONG: L<string> = {
  en: 'One too many digits? Keep just the 10-digit number.',
  hi: 'अंक ज़्यादा हो गए? बस 10 अंकों का नंबर रखिए।',
  gu: 'આંકડા વધુ થઈ ગયા? ફક્ત 10 આંકડાનો નંબર રાખો.',
};

/**
 * How Manhar Bot reacts to an event. `seq` rotates the cheer so repeated acceptances do not repeat a word.
 * Pure on purpose: it is unit-tested for every event in every language.
 */
export function reactTo(event: BuddyEvent, lang: TourLang, seq = 0): Reaction {
  switch (event.type) {
    case 'welcome':
      return { mood: 'hello', text: WELCOME[lang] };
    case 'nudge':
      return { mood: 'nudge', text: NUDGE[lang] };
    case 'ask': {
      const text = (ASK_NEXT[event.field] ?? ASK_NEXT.restaurantName)?.[lang] ?? WELCOME[lang];
      if (event.first) return { mood: 'hello', text };
      return event.again ? { mood: 'nudge', text: ASK_AGAIN[lang](text) } : { mood: 'explain', text };
    }
    case 'ready':
      return { mood: 'cheer', text: READY[lang] };
    case 'focus': {
      const text = FOCUS[event.field]?.[lang];
      return { mood: event.field === 'message' ? 'think' : 'watch', text: text ?? WELCOME[lang] };
    }
    case 'typing': {
      if (event.valid) return { mood: 'cheer', text: PHONE_OK[lang] };
      if (event.digits > 10) return { mood: 'worry', text: PHONE_TOO_LONG[lang] };
      return { mood: 'watch', text: PHONE_PROGRESS(event.digits)[lang] };
    }
    case 'valid': {
      const list = VALID[lang];
      return { mood: 'cheer', text: list[seq % list.length] ?? list[0] ?? '' };
    }
    case 'invalid':
      return { mood: 'worry', text: (INVALID[event.field] ?? INVALID.default)[lang] };
    case 'consent':
      return event.checked
        ? { mood: 'cheer', text: CONSENT_ON[lang] }
        : { mood: 'worry', text: INVALID.consent?.[lang] ?? INVALID.default[lang] };
    case 'submit':
      return { mood: 'fly', text: SUBMIT[lang] };
    case 'success':
      return { mood: 'done', text: SUCCESS(event.referenceCode)[lang] };
    case 'failure':
      return { mood: 'worry', text: FAILURE[event.kind][lang] };
  }
}

export const BUDDY_UI: L<{ hide: string; show: string; label: string }> = {
  en: { hide: 'Hide Manhar Bot', show: 'Show Manhar Bot', label: 'Manhar Bot, your form helper' },
  hi: { hide: 'मनहर बॉट छिपाएँ', show: 'मनहर बॉट दिखाएँ', label: 'मनहर बॉट, आपका फ़ॉर्म सहायक' },
  gu: { hide: 'મનહર બોટ છુપાવો', show: 'મનહર બોટ બતાવો', label: 'મનહર બોટ, તમારો ફોર્મ સહાયક' },
};
