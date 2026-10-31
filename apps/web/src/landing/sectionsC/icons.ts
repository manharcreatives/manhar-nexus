import {
  Check,
  ClipboardList,
  Copy,
  CreditCard,
  KeyRound,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Rocket,
  Search,
  Share2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

/** Icons used by the sections-C components, resolved from the lucide NAME strings in content. */
const BY_NAME: Readonly<Record<string, LucideIcon>> = {
  ClipboardList,
  CreditCard,
  KeyRound,
  Rocket,
  ShieldCheck,
};

export function iconByName(name: string, fallback: LucideIcon = Check): LucideIcon {
  return BY_NAME[name] ?? fallback;
}

export { Check, Copy, Link2, Mail, MapPin, MessageCircle, Phone, Search, Share2, ShieldCheck };
