import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientsPage } from './ClientsPage';
import { OfferingsPage } from './OfferingsPage';
import { PriceBooksPage } from './PriceBooksPage';
import { BundlesPage } from './BundlesPage';

type CommercialTab = 'clients' | 'offerings' | 'price-books' | 'bundles';

function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-700'
          : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );
}

export function CommercialPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<CommercialTab>('clients');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('commercial.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('commercial.subtitle')}</p>
      </div>

      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-1">
          <Tab label={t('commercial.tabs.clients')} active={tab === 'clients'} onClick={() => setTab('clients')} />
          <Tab label={t('commercial.tabs.offerings')} active={tab === 'offerings'} onClick={() => setTab('offerings')} />
          <Tab label={t('commercial.tabs.priceBooks')} active={tab === 'price-books'} onClick={() => setTab('price-books')} />
          <Tab label={t('commercial.tabs.bundles')} active={tab === 'bundles'} onClick={() => setTab('bundles')} />
        </nav>
      </div>

      {tab === 'clients' && <ClientsPage />}
      {tab === 'offerings' && <OfferingsPage />}
      {tab === 'price-books' && <PriceBooksPage />}
      {tab === 'bundles' && <BundlesPage />}
    </div>
  );
}
