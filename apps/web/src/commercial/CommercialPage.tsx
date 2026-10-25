import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../ui/PageHeader';
import { Tabs } from '../ui/Tabs';
import { ClientsPage } from './ClientsPage';
import { OfferingsPage } from './OfferingsPage';
import { PriceBooksPage } from './PriceBooksPage';
import { BundlesPage } from './BundlesPage';

type CommercialTab = 'clients' | 'offerings' | 'price-books' | 'bundles';

export function CommercialPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<CommercialTab>('clients');

  return (
    <div>
      <PageHeader title={t('commercial.title')} description={t('commercial.subtitle')} />
      <Tabs
        label={t('commercial.tabsLabel')}
        active={tab}
        onChange={(k) => setTab(k as CommercialTab)}
        items={[
          { key: 'clients', label: t('commercial.tabs.clients') },
          { key: 'offerings', label: t('commercial.tabs.offerings') },
          { key: 'price-books', label: t('commercial.tabs.priceBooks') },
          { key: 'bundles', label: t('commercial.tabs.bundles') },
        ]}
      />
      <div role="tabpanel">
        {tab === 'clients' && <ClientsPage />}
        {tab === 'offerings' && <OfferingsPage />}
        {tab === 'price-books' && <PriceBooksPage />}
        {tab === 'bundles' && <BundlesPage />}
      </div>
    </div>
  );
}
