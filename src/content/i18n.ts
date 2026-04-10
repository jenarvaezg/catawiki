type LabelKey =
  | 'total_price'
  | 'next_bid_total'
  | 'commission'
  | 'shipping'
  | 'excl_shipping'
  | 'free_shipping'
  | 'calculating'
  | 'numista_lookup'
  | 'numista_refresh'
  | 'numista_loading'
  | 'numista_value'
  | 'numista_cached'
  | 'numista_api_key_prompt'
  | 'numista_invalid_api_key'
  | 'numista_no_match'
  | 'numista_no_issue'
  | 'numista_no_prices'
  | 'numista_error'
  | 'numista_alternatives'
  | 'numista_use_match'
  | 'numista_manual_match'
  | 'numista_saved_match'
  | 'bullion_lookup'
  | 'bullion_refresh'
  | 'bullion_loading'
  | 'bullion_direct'
  | 'bullion_needs_input'
  | 'bullion_error'
  | 'bullion_input_label'
  | 'bullion_title_basis'
  | 'bullion_numista_cache_basis'
  | 'bullion_value'
  | 'bullion_badge'
  | 'bullion_fine_weight'
  | 'bullion_spot'
  | 'ignore_lot'
  | 'ignored_lots_manage'
  | 'ignored_lots_title'
  | 'ignored_lots_empty'
  | 'ignored_lots_restore'
  | 'ignored_lots_open'
  | 'ignored_lots_reload_hint'
  | 'listing_filters_manage'
  | 'listing_filters_title'
  | 'listing_filters_only_no_reserve'
  | 'listing_filters_max_total'
  | 'listing_filters_max_shipping'
  | 'listing_filters_reset'
  | 'listing_filters_hint'
  | 'update_available'
  | 'update_open_release'
  | 'update_dismiss'
  | 'update_manual_hint';

const LABELS: Record<string, Record<LabelKey, string>> = {
  en: {
    total_price: 'Estimated total',
    next_bid_total: 'Next bid total',
    commission: 'Commission',
    shipping: 'Shipping',
    excl_shipping: 'excl. shipping',
    free_shipping: 'Free shipping',
    calculating: 'Calculating…',
    numista_lookup: 'Check Numista value',
    numista_refresh: 'Refresh Numista value',
    numista_loading: 'Checking Numista…',
    numista_value: 'Numista market value',
    numista_cached: 'Local cache',
    numista_api_key_prompt: 'Enter your Numista API key',
    numista_invalid_api_key: 'The stored Numista API key is invalid. Enter a new key',
    numista_no_match: 'No clear Numista match found for this lot.',
    numista_no_issue: 'Numista found the type, but not a matching issue for the year.',
    numista_no_prices: 'Numista found the type, but there are no price estimates for that issue.',
    numista_error: 'Numista request failed.',
    numista_alternatives: 'Other possible matches',
    numista_use_match: 'Use this match',
    numista_manual_match: 'Manual match',
    numista_saved_match: 'Saved match',
    bullion_lookup: 'Calculate melt value',
    bullion_refresh: 'Refresh melt value',
    bullion_loading: 'Checking metal spot…',
    bullion_direct: 'Bullion value calculated from the lot title. Numista was skipped.',
    bullion_needs_input: 'Fine weight could not be determined automatically. Enter it manually.',
    bullion_error: 'Bullion value request failed.',
    bullion_input_label: 'Fine weight',
    bullion_title_basis: 'Calculated from the lot title.',
    bullion_numista_cache_basis: 'Calculated from cached Numista data.',
    bullion_value: 'Bullion / melt value',
    bullion_badge: 'Bullion',
    bullion_fine_weight: 'g fine',
    bullion_spot: 'Spot',
    ignore_lot: 'Ignore this lot',
    ignored_lots_manage: 'Ignored',
    ignored_lots_title: 'Ignored lots',
    ignored_lots_empty: 'No ignored lots yet.',
    ignored_lots_restore: 'Restore',
    ignored_lots_open: 'Open',
    ignored_lots_reload_hint: 'Restored lots will appear again after reloading the page.',
    listing_filters_manage: 'Filters',
    listing_filters_title: 'Listing filters',
    listing_filters_only_no_reserve: 'Only no-reserve lots',
    listing_filters_max_total: 'Max estimated total',
    listing_filters_max_shipping: 'Max shipping',
    listing_filters_reset: 'Reset filters',
    listing_filters_hint: 'Applies to listing cards and related lots on detail pages.',
    update_available: 'Extension update available',
    update_open_release: 'Open release',
    update_dismiss: 'Dismiss',
    update_manual_hint: 'Download the latest release and reload the extension.',
  },
  es: {
    total_price: 'Total estimado',
    next_bid_total: 'Total sig. puja',
    commission: 'Comisión',
    shipping: 'Envío',
    excl_shipping: 'sin envío',
    free_shipping: 'Envío gratuito',
    calculating: 'Calculando…',
    numista_lookup: 'Buscar valor en Numista',
    numista_refresh: 'Actualizar valor Numista',
    numista_loading: 'Consultando Numista…',
    numista_value: 'Valor de mercado en Numista',
    numista_cached: 'Caché local',
    numista_api_key_prompt: 'Introduce tu API key de Numista',
    numista_invalid_api_key: 'La API key guardada de Numista no es válida. Introduce una nueva',
    numista_no_match: 'No se ha encontrado una coincidencia clara en Numista para este lote.',
    numista_no_issue: 'Numista encontró el tipo, pero no un issue que encaje con el año.',
    numista_no_prices: 'Numista encontró el tipo, pero no tiene estimaciones de precio para ese issue.',
    numista_error: 'Falló la consulta a Numista.',
    numista_alternatives: 'Otras coincidencias posibles',
    numista_use_match: 'Usar este match',
    numista_manual_match: 'Match manual',
    numista_saved_match: 'Match guardado',
    bullion_lookup: 'Calcular fundición',
    bullion_refresh: 'Actualizar fundición',
    bullion_loading: 'Consultando spot del metal…',
    bullion_direct: 'Valor bullion calculado desde el título del lote. Se ha omitido Numista.',
    bullion_needs_input: 'No se han podido detectar automáticamente los gramos finos. Introdúcelos manualmente.',
    bullion_error: 'Falló el cálculo del valor bullion.',
    bullion_input_label: 'Peso fino',
    bullion_title_basis: 'Calculado desde el título del lote.',
    bullion_numista_cache_basis: 'Calculado desde caché de Numista.',
    bullion_value: 'Valor bullion / fundición',
    bullion_badge: 'Bullion',
    bullion_fine_weight: 'g finos',
    bullion_spot: 'Spot',
    ignore_lot: 'Ignorar este lote',
    ignored_lots_manage: 'Ignorados',
    ignored_lots_title: 'Lotes ignorados',
    ignored_lots_empty: 'Aún no hay lotes ignorados.',
    ignored_lots_restore: 'Restaurar',
    ignored_lots_open: 'Abrir',
    ignored_lots_reload_hint: 'Los lotes restaurados volverán a salir al recargar la página.',
    listing_filters_manage: 'Filtros',
    listing_filters_title: 'Filtros de listado',
    listing_filters_only_no_reserve: 'Sólo lotes sin reserva',
    listing_filters_max_total: 'Total estimado máximo',
    listing_filters_max_shipping: 'Envío máximo',
    listing_filters_reset: 'Resetear filtros',
    listing_filters_hint: 'Se aplica a listados y a lotes relacionados en la ficha.',
    update_available: 'Hay una actualización de la extensión',
    update_open_release: 'Abrir release',
    update_dismiss: 'Ocultar',
    update_manual_hint: 'Descarga la última release y recarga la extensión.',
  },
  de: {
    total_price: 'Geschätzter Gesamtpreis',
    next_bid_total: 'Gesamtpreis nächstes Gebot',
    commission: 'Provision',
    shipping: 'Versand',
    excl_shipping: 'zzgl. Versand',
    free_shipping: 'Kostenloser Versand',
    calculating: 'Wird berechnet…',
    numista_lookup: 'Numista-Wert suchen',
    numista_refresh: 'Numista-Wert aktualisieren',
    numista_loading: 'Numista wird abgefragt…',
    numista_value: 'Numista-Marktwert',
    numista_cached: 'Lokaler Cache',
    numista_api_key_prompt: 'Numista-API-Schlüssel eingeben',
    numista_invalid_api_key: 'Der gespeicherte Numista-API-Schlüssel ist ungültig. Bitte neu eingeben',
    numista_no_match: 'Keine eindeutige Numista-Übereinstimmung für dieses Los gefunden.',
    numista_no_issue: 'Numista hat den Typ gefunden, aber kein passendes Ausgabejahr.',
    numista_no_prices: 'Numista hat den Typ gefunden, aber keine Preisangaben für diese Ausgabe.',
    numista_error: 'Numista-Anfrage fehlgeschlagen.',
    numista_alternatives: 'Weitere mögliche Treffer',
    numista_use_match: 'Diesen Treffer verwenden',
    numista_manual_match: 'Manueller Treffer',
    numista_saved_match: 'Gespeicherter Treffer',
    bullion_lookup: 'Schmelzwert berechnen',
    bullion_refresh: 'Schmelzwert aktualisieren',
    bullion_loading: 'Metall-Spot wird abgefragt…',
    bullion_direct: 'Bullion-Wert direkt aus dem Los-Titel berechnet. Numista wurde übersprungen.',
    bullion_needs_input: 'Das Feingewicht konnte nicht automatisch erkannt werden. Bitte manuell eingeben.',
    bullion_error: 'Bullion-Wert konnte nicht berechnet werden.',
    bullion_input_label: 'Feingewicht',
    bullion_title_basis: 'Aus dem Los-Titel berechnet.',
    bullion_numista_cache_basis: 'Aus gecachten Numista-Daten berechnet.',
    bullion_value: 'Bullion- / Schmelzwert',
    bullion_badge: 'Bullion',
    bullion_fine_weight: 'g fein',
    bullion_spot: 'Spot',
    ignore_lot: 'Dieses Los ignorieren',
    ignored_lots_manage: 'Ignoriert',
    ignored_lots_title: 'Ignorierte Lose',
    ignored_lots_empty: 'Noch keine ignorierten Lose.',
    ignored_lots_restore: 'Wiederherstellen',
    ignored_lots_open: 'Öffnen',
    ignored_lots_reload_hint: 'Wiederhergestellte Lose erscheinen nach dem Neuladen der Seite wieder.',
    listing_filters_manage: 'Filter',
    listing_filters_title: 'Listenfilter',
    listing_filters_only_no_reserve: 'Nur Lose ohne Mindestpreis',
    listing_filters_max_total: 'Max. geschätzter Gesamtpreis',
    listing_filters_max_shipping: 'Max. Versand',
    listing_filters_reset: 'Filter zurücksetzen',
    listing_filters_hint: 'Gilt für Listen und verwandte Lose auf Detailseiten.',
    update_available: 'Erweiterungs-Update verfügbar',
    update_open_release: 'Release öffnen',
    update_dismiss: 'Ausblenden',
    update_manual_hint: 'Lade die neueste Release herunter und lade die Erweiterung neu.',
  },
  fr: {
    total_price: 'Total estimé',
    next_bid_total: 'Total enchère suivante',
    commission: 'Commission',
    shipping: 'Livraison',
    excl_shipping: 'hors livraison',
    free_shipping: 'Livraison gratuite',
    calculating: 'Calcul en cours…',
    numista_lookup: 'Chercher la valeur Numista',
    numista_refresh: 'Actualiser la valeur Numista',
    numista_loading: 'Interrogation de Numista…',
    numista_value: 'Valeur de marché Numista',
    numista_cached: 'Cache local',
    numista_api_key_prompt: 'Saisissez votre clé API Numista',
    numista_invalid_api_key: 'La clé API Numista enregistrée est invalide. Saisissez-en une nouvelle',
    numista_no_match: 'Aucune correspondance Numista claire pour ce lot.',
    numista_no_issue: 'Numista a trouvé le type, mais pas l’émission correspondant à l’année.',
    numista_no_prices: 'Numista a trouvé le type, mais il n’y a pas d’estimation de prix pour cette émission.',
    numista_error: 'La requête Numista a échoué.',
    numista_alternatives: 'Autres correspondances possibles',
    numista_use_match: 'Utiliser cette correspondance',
    numista_manual_match: 'Correspondance manuelle',
    numista_saved_match: 'Correspondance enregistrée',
    bullion_lookup: 'Calculer la fonte',
    bullion_refresh: 'Actualiser la fonte',
    bullion_loading: 'Interrogation du spot métal…',
    bullion_direct: 'Valeur bullion calculée depuis le titre du lot. Numista a été ignoré.',
    bullion_needs_input: 'Le poids fin n’a pas pu être détecté automatiquement. Saisissez-le manuellement.',
    bullion_error: 'Le calcul de la valeur bullion a échoué.',
    bullion_input_label: 'Poids fin',
    bullion_title_basis: 'Calculée depuis le titre du lot.',
    bullion_numista_cache_basis: 'Calculée depuis le cache Numista.',
    bullion_value: 'Valeur bullion / fonte',
    bullion_badge: 'Bullion',
    bullion_fine_weight: 'g fin',
    bullion_spot: 'Spot',
    ignore_lot: 'Ignorer ce lot',
    ignored_lots_manage: 'Ignorés',
    ignored_lots_title: 'Lots ignorés',
    ignored_lots_empty: 'Aucun lot ignoré pour le moment.',
    ignored_lots_restore: 'Restaurer',
    ignored_lots_open: 'Ouvrir',
    ignored_lots_reload_hint: 'Les lots restaurés réapparaîtront après rechargement de la page.',
    listing_filters_manage: 'Filtres',
    listing_filters_title: 'Filtres de liste',
    listing_filters_only_no_reserve: 'Seulement les lots sans réserve',
    listing_filters_max_total: 'Total estimé max',
    listing_filters_max_shipping: 'Livraison max',
    listing_filters_reset: 'Réinitialiser les filtres',
    listing_filters_hint: 'S’applique aux listes et aux lots liés sur la fiche.',
    update_available: 'Une mise à jour de l’extension est disponible',
    update_open_release: 'Ouvrir la release',
    update_dismiss: 'Masquer',
    update_manual_hint: 'Téléchargez la dernière release puis rechargez l’extension.',
  },
  nl: {
    total_price: 'Geschatte totaalprijs',
    next_bid_total: 'Totaal volgend bod',
    commission: 'Commissie',
    shipping: 'Verzending',
    excl_shipping: 'excl. verzending',
    free_shipping: 'Gratis verzending',
    calculating: 'Berekenen…',
    numista_lookup: 'Numista-waarde zoeken',
    numista_refresh: 'Numista-waarde vernieuwen',
    numista_loading: 'Numista wordt geraadpleegd…',
    numista_value: 'Numista-marktwaarde',
    numista_cached: 'Lokale cache',
    numista_api_key_prompt: 'Voer je Numista API-sleutel in',
    numista_invalid_api_key: 'De opgeslagen Numista API-sleutel is ongeldig. Voer een nieuwe in',
    numista_no_match: 'Geen duidelijke Numista-match gevonden voor dit kavel.',
    numista_no_issue: 'Numista vond het type, maar niet de juiste uitgave voor het jaar.',
    numista_no_prices: 'Numista vond het type, maar heeft geen prijsinschattingen voor die uitgave.',
    numista_error: 'Numista-aanvraag mislukt.',
    numista_alternatives: 'Andere mogelijke matches',
    numista_use_match: 'Gebruik deze match',
    numista_manual_match: 'Handmatige match',
    numista_saved_match: 'Opgeslagen match',
    bullion_lookup: 'Smeltwaarde berekenen',
    bullion_refresh: 'Smeltwaarde vernieuwen',
    bullion_loading: 'Metaalspot wordt opgehaald…',
    bullion_direct: 'Bullionwaarde berekend uit de lottitel. Numista is overgeslagen.',
    bullion_needs_input: 'Het fijne gewicht kon niet automatisch worden bepaald. Voer het handmatig in.',
    bullion_error: 'Bullionwaarde berekenen is mislukt.',
    bullion_input_label: 'Fijn gewicht',
    bullion_title_basis: 'Berekend uit de lottitel.',
    bullion_numista_cache_basis: 'Berekend uit Numista-cache.',
    bullion_value: 'Bullion- / smeltwaarde',
    bullion_badge: 'Bullion',
    bullion_fine_weight: 'g fijn',
    bullion_spot: 'Spot',
    ignore_lot: 'Dit kavel negeren',
    ignored_lots_manage: 'Genegeerd',
    ignored_lots_title: 'Genegeerde kavels',
    ignored_lots_empty: 'Nog geen genegeerde kavels.',
    ignored_lots_restore: 'Herstellen',
    ignored_lots_open: 'Openen',
    ignored_lots_reload_hint: 'Herstelde kavels verschijnen weer nadat je de pagina herlaadt.',
    listing_filters_manage: 'Filters',
    listing_filters_title: 'Lijstfilters',
    listing_filters_only_no_reserve: 'Alleen kavels zonder minimumprijs',
    listing_filters_max_total: 'Max. geschatte totaalprijs',
    listing_filters_max_shipping: 'Max. verzending',
    listing_filters_reset: 'Filters resetten',
    listing_filters_hint: 'Geldt voor lijsten en gerelateerde kavels op detailpagina’s.',
    update_available: 'Er is een extensie-update beschikbaar',
    update_open_release: 'Release openen',
    update_dismiss: 'Verbergen',
    update_manual_hint: 'Download de nieuwste release en laad de extensie opnieuw.',
  },
};

const CARD_STATUSES = {
  en: {
    current: ['Current bid'],
    starting: ['Starting bid'],
    'buy-now': ['Buy now'],
    final: ['Final bid'],
    closed: ['Closed for bidding'],
  },
  es: {
    current: ['Puja actual'],
    starting: ['Puja inicial'],
    'buy-now': ['Comprar ahora'],
    final: ['Puja final'],
    closed: ['Cerrado para pujar'],
  },
  de: {
    current: ['Aktuelles Gebot'],
    starting: ['Startgebot'],
    'buy-now': ['Sofort kaufen'],
    final: ['Letztes Gebot'],
    closed: ['Bieten geschlossen'],
  },
  fr: {
    current: ['Enchère actuelle'],
    starting: ['Mise de départ'],
    'buy-now': ['Acheter maintenant'],
    final: ['Enchère finale'],
    closed: ['Enchères terminées'],
  },
  nl: {
    current: ['Huidig bod'],
    starting: ['Startbod'],
    'buy-now': ['Nu kopen'],
    final: ['Laatste bod'],
    closed: ['Gesloten voor biedingen'],
  },
} as const;

const ACTIVE_STATUSES: Record<string, readonly string[]> = {
  en: [...CARD_STATUSES.en.current, ...CARD_STATUSES.en.starting, ...CARD_STATUSES.en['buy-now']],
  es: [...CARD_STATUSES.es.current, ...CARD_STATUSES.es.starting, ...CARD_STATUSES.es['buy-now']],
  de: [...CARD_STATUSES.de.current, ...CARD_STATUSES.de.starting, ...CARD_STATUSES.de['buy-now']],
  fr: [...CARD_STATUSES.fr.current, ...CARD_STATUSES.fr.starting, ...CARD_STATUSES.fr['buy-now']],
  nl: [...CARD_STATUSES.nl.current, ...CARD_STATUSES.nl.starting, ...CARD_STATUSES.nl['buy-now']],
};

const SKIP_STATUSES: Record<string, readonly string[]> = {
  en: [...CARD_STATUSES.en.final, ...CARD_STATUSES.en.closed],
  es: [...CARD_STATUSES.es.final, ...CARD_STATUSES.es.closed],
  de: [...CARD_STATUSES.de.final, ...CARD_STATUSES.de.closed],
  fr: [...CARD_STATUSES.fr.final, ...CARD_STATUSES.fr.closed],
  nl: [...CARD_STATUSES.nl.final, ...CARD_STATUSES.nl.closed],
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

export function getCardStatus(locale: string, statusText: string) {
  const texts = CARD_STATUSES[locale as keyof typeof CARD_STATUSES] ?? CARD_STATUSES.en;

  if (texts.current.some((value) => statusText.includes(value))) return 'current';
  if (texts.starting.some((value) => statusText.includes(value))) return 'starting';
  if (texts['buy-now'].some((value) => statusText.includes(value))) return 'buy-now';
  if (texts.final.some((value) => statusText.includes(value))) return 'final';
  if (texts.closed.some((value) => statusText.includes(value))) return 'closed';

  return 'unknown';
}
