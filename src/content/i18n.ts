type LabelKey =
  | 'total_price'
  | 'commission'
  | 'shipping'
  | 'excl_shipping'
  | 'free_shipping';

const LABELS: Record<string, Record<LabelKey, string>> = {
  en: {
    total_price: 'Estimated total',
    commission: 'Commission',
    shipping: 'Shipping',
    excl_shipping: 'excl. shipping',
    free_shipping: 'Free shipping',
  },
  es: {
    total_price: 'Total estimado',
    commission: 'Comisión',
    shipping: 'Envío',
    excl_shipping: 'sin envío',
    free_shipping: 'Envío gratuito',
  },
  de: {
    total_price: 'Geschätzter Gesamtpreis',
    commission: 'Provision',
    shipping: 'Versand',
    excl_shipping: 'zzgl. Versand',
    free_shipping: 'Kostenloser Versand',
  },
  fr: {
    total_price: 'Total estimé',
    commission: 'Commission',
    shipping: 'Livraison',
    excl_shipping: 'hors livraison',
    free_shipping: 'Livraison gratuite',
  },
  nl: {
    total_price: 'Geschatte totaalprijs',
    commission: 'Commissie',
    shipping: 'Verzending',
    excl_shipping: 'excl. verzending',
    free_shipping: 'Gratis verzending',
  },
};

const ACTIVE_STATUSES: Record<string, readonly string[]> = {
  en: ['Current bid', 'Starting bid', 'Buy now'],
  es: ['Puja actual', 'Puja inicial', 'Comprar ahora'],
  de: ['Aktuelles Gebot', 'Startgebot', 'Sofort kaufen'],
  fr: ['Enchère actuelle', 'Mise de départ', 'Acheter maintenant'],
  nl: ['Huidig bod', 'Startbod', 'Nu kopen'],
};

const SKIP_STATUSES: Record<string, readonly string[]> = {
  en: ['Final bid', 'Closed for bidding'],
  es: ['Puja final', 'Cerrado para pujar'],
  de: ['Letztes Gebot', 'Bieten geschlossen'],
  fr: ['Enchère finale', 'Enchères terminées'],
  nl: ['Laatste bod', 'Gesloten voor biedingen'],
};

const SUPPORTED_LOCALES = new Set(['en', 'es', 'de', 'fr', 'nl']);

export function detectLocale(): string {
  const match = /\/([a-z]{2})\//.exec(window.location.pathname);
  const candidate = match?.[1] ?? 'en';
  return SUPPORTED_LOCALES.has(candidate) ? candidate : 'en';
}

export function getLabel(key: LabelKey, locale: string): string {
  return LABELS[locale]?.[key] ?? LABELS.en[key];
}

export function getActiveCardStatuses(locale: string): readonly string[] {
  return ACTIVE_STATUSES[locale] ?? ACTIVE_STATUSES.en;
}

export function getSkipCardStatuses(locale: string): readonly string[] {
  return SKIP_STATUSES[locale] ?? SKIP_STATUSES.en;
}
