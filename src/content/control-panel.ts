import type { Platform } from '../platforms/platform';
import { detectLocale, getLabel } from './i18n';
import { getListingFilters, resetListingFilters, setListingFilters, type ListingFilters } from './listing-filters';
import { getIgnoredLots, unignoreLot, type IgnoredLotEntry } from './ignored-lots';
import { addBidder, getBidderMapping, removeBidder, type BidderMapping } from './bidder-mapping';
import { updateListingTotals } from './listing-injector';
import { BUILD_INFO } from '../shared/build-info';
import {
  ACTION_BUTTON_STYLES,
  BREAKDOWN_STYLES,
  EXT_ATTR,
  LINK_STYLES,
  TOTAL_LABEL_STYLES,
  applyStyles,
  createExtElement,
} from './styles';

type Tab = 'filters' | 'ignored' | 'bidders' | 'settings';

let panelOpen = false;
let activeTab: Tab = 'filters';
let currentPlatform: Platform | null = null;
let storageListenerInstalled = false;

// --- Storage listener ---

function ensureStorageListener(): void {
  if (storageListenerInstalled) return;

  const onChanged = globalThis.chrome?.storage?.onChanged;
  if (!onChanged?.addListener) return;

  onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    const relevant =
      'listingFilters.v1' in changes
      || 'ignoredLots.v2' in changes
      || 'ignoredLotIds.v1' in changes
      || 'bidderMapping.v1' in changes;

    if (!relevant) return;

    if ('listingFilters.v1' in changes && currentPlatform) {
      updateListingTotals(currentPlatform);
    }

    void renderPanel();
  });

  storageListenerInstalled = true;
}

// --- Helpers ---

function createButton(label: string, styles: Record<string, string> = {}): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  applyStyles(button, {
    ...ACTION_BUTTON_STYLES,
    marginTop: '0',
    padding: '6px 10px',
    fontSize: '11px',
    ...styles,
  });
  button.textContent = label;
  return button;
}

function parseNumberInput(input: HTMLInputElement): number | null {
  const value = input.value.trim();
  if (value === '') return null;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildNumberField(labelText: string, value: number | null): { wrapper: HTMLElement; input: HTMLInputElement } {
  const wrapper = document.createElement('label');
  applyStyles(wrapper, {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '12px',
    color: '#1A1A1A',
    fontWeight: '600',
  });

  const text = document.createElement('span');
  text.textContent = labelText;
  wrapper.appendChild(text);

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '0.01';
  input.value = value === null ? '' : String(value);
  applyStyles(input, {
    height: '34px',
    padding: '0 10px',
    border: '1px solid #D0D0D0',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  });
  wrapper.appendChild(input);

  return { wrapper, input };
}

// --- FAB button ---

function createFAB(filterCount: number, ignoredCount: number): HTMLElement {
  const fab = createExtElement('button', 'control-fab') as HTMLButtonElement;
  fab.type = 'button';

  const badges: string[] = [];
  if (filterCount > 0) badges.push(`${filterCount} filtro${filterCount > 1 ? 's' : ''}`);
  if (ignoredCount > 0) badges.push(`${ignoredCount} ignorado${ignoredCount > 1 ? 's' : ''}`);
  const badgeText = badges.length > 0 ? ` · ${badges.join(' · ')}` : '';

  fab.textContent = `\uD83E\uDE99${badgeText}`;
  fab.title = 'CoinScope';

  applyStyles(fab, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: '2147483646',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '40px',
    padding: '0 14px',
    border: '1px solid #D7E3FF',
    borderRadius: '999px',
    backgroundColor: '#FFFFFF',
    color: '#0033FF',
    fontSize: '13px',
    fontWeight: '700',
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
    transition: 'box-shadow 0.15s ease',
  });

  fab.addEventListener('mouseenter', () => {
    fab.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.18)';
  });
  fab.addEventListener('mouseleave', () => {
    fab.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
  });

  fab.addEventListener('click', () => {
    panelOpen = !panelOpen;
    void renderPanel();
  });

  return fab;
}

// --- Tabs ---

function createTabBar(locale: string, platform: Platform | null): HTMLElement {
  const bar = document.createElement('div');
  applyStyles(bar, {
    display: 'flex',
    gap: '0',
    borderBottom: '2px solid #EEEEEE',
    marginBottom: '12px',
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'filters', label: getLabel('listing_filters_manage', locale) },
    { id: 'ignored', label: getLabel('ignored_lots_manage', locale) },
  ];

  if (platform?.id === 'catawiki') {
    tabs.push({ id: 'bidders', label: getLabel('bidders_manage', locale) });
  }

  tabs.push({ id: 'settings', label: 'Info' });

  tabs.forEach(({ id, label }) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = label;
    const isActive = id === activeTab;

    applyStyles(tab, {
      flex: '1',
      padding: '8px 4px',
      border: 'none',
      borderBottom: isActive ? '2px solid #0033FF' : '2px solid transparent',
      backgroundColor: 'transparent',
      color: isActive ? '#0033FF' : '#888',
      fontSize: '12px',
      fontWeight: '700',
      cursor: 'pointer',
      marginBottom: '-2px',
    });

    tab.addEventListener('click', () => {
      activeTab = id;
      void renderPanel();
    });

    bar.appendChild(tab);
  });

  return bar;
}

// --- Filter tab ---

function createFiltersTab(filters: ListingFilters, locale: string): HTMLElement {
  const container = document.createElement('div');

  const hint = document.createElement('span');
  applyStyles(hint, BREAKDOWN_STYLES);
  hint.textContent = getLabel('listing_filters_hint', locale);
  container.appendChild(hint);

  const fields = document.createElement('div');
  applyStyles(fields, {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '12px',
  });
  container.appendChild(fields);

  // No-reserve checkbox
  const reserveLabel = document.createElement('label');
  applyStyles(reserveLabel, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#1A1A1A',
    fontWeight: '600',
  });
  const reserveCheckbox = document.createElement('input');
  reserveCheckbox.type = 'checkbox';
  reserveCheckbox.checked = filters.onlyNoReserve;
  reserveLabel.appendChild(reserveCheckbox);
  reserveLabel.appendChild(document.createTextNode(getLabel('listing_filters_only_no_reserve', locale)));
  fields.appendChild(reserveLabel);

  // Max total
  const totalField = buildNumberField(getLabel('listing_filters_max_total', locale), filters.maxEstimatedTotal);
  fields.appendChild(totalField.wrapper);

  // Max shipping
  const shippingField = buildNumberField(getLabel('listing_filters_max_shipping', locale), filters.maxShipping);
  fields.appendChild(shippingField.wrapper);

  // Persist on change
  const persistFilters = async () => {
    await setListingFilters({
      onlyNoReserve: reserveCheckbox.checked,
      maxEstimatedTotal: parseNumberInput(totalField.input),
      maxShipping: parseNumberInput(shippingField.input),
    });
  };

  reserveCheckbox.addEventListener('change', () => { void persistFilters(); });
  totalField.input.addEventListener('change', () => { void persistFilters(); });
  shippingField.input.addEventListener('change', () => { void persistFilters(); });

  // Reset button
  const resetButton = createButton(getLabel('listing_filters_reset', locale), {
    border: '1px solid #D0D0D0',
    color: '#666',
    marginTop: '12px',
  });
  resetButton.addEventListener('click', () => { void resetListingFilters(); });
  container.appendChild(resetButton);

  return container;
}

// --- Ignored tab ---

function createIgnoredTab(lots: readonly IgnoredLotEntry[], locale: string): HTMLElement {
  const container = document.createElement('div');

  if (lots.length === 0) {
    const empty = document.createElement('div');
    applyStyles(empty, BREAKDOWN_STYLES);
    empty.textContent = getLabel('ignored_lots_empty', locale);
    container.appendChild(empty);
    return container;
  }

  const hint = document.createElement('span');
  applyStyles(hint, BREAKDOWN_STYLES);
  hint.textContent = getLabel('ignored_lots_reload_hint', locale);
  container.appendChild(hint);

  const list = document.createElement('div');
  applyStyles(list, {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '10px',
  });
  container.appendChild(list);

  lots.forEach((lot) => {
    const item = document.createElement('div');
    applyStyles(item, {
      paddingTop: '8px',
      borderTop: '1px solid #EEEEEE',
    });

    const title = document.createElement('div');
    applyStyles(title, {
      fontSize: '12px',
      fontWeight: '700',
      color: '#1A1A1A',
      lineHeight: '1.35',
    });
    title.textContent = lot.title;
    item.appendChild(title);

    const meta = document.createElement('div');
    applyStyles(meta, { ...BREAKDOWN_STYLES, marginTop: '3px' });
    meta.textContent = `${lot.lotId} · ${new Date(lot.ignoredAt).toLocaleString(locale)}`;
    item.appendChild(meta);

    const actions = document.createElement('div');
    applyStyles(actions, {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      marginTop: '6px',
    });

    const openLink = document.createElement('a');
    openLink.href = lot.lotUrl;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    applyStyles(openLink, { ...LINK_STYLES, fontSize: '11px' });
    openLink.textContent = getLabel('ignored_lots_open', locale);
    actions.appendChild(openLink);

    const restoreButton = createButton(getLabel('ignored_lots_restore', locale), {
      border: '1px solid #D0D0D0',
      color: '#666',
    });
    restoreButton.addEventListener('click', () => {
      restoreButton.disabled = true;
      void unignoreLot(lot.lotId).catch(() => {
        restoreButton.disabled = false;
      });
    });
    actions.appendChild(restoreButton);

    item.appendChild(actions);
    list.appendChild(item);
  });

  return container;
}

// --- Bidders tab ---

function createBiddersTab(mapping: BidderMapping, locale: string): HTMLElement {
  const container = document.createElement('div');

  const hint = document.createElement('span');
  applyStyles(hint, BREAKDOWN_STYLES);
  hint.textContent = getLabel('bidders_hint', locale);
  container.appendChild(hint);

  // Add form: ID + name + submit
  const form = document.createElement('form');
  applyStyles(form, {
    display: 'flex',
    gap: '6px',
    marginTop: '10px',
    alignItems: 'stretch',
  });

  const idInput = document.createElement('input');
  idInput.type = 'text';
  idInput.inputMode = 'numeric';
  idInput.placeholder = getLabel('bidders_id_placeholder', locale);
  applyStyles(idInput, {
    flex: '0 0 96px',
    height: '34px',
    padding: '0 10px',
    border: '1px solid #D0D0D0',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  });
  form.appendChild(idInput);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = getLabel('bidders_name_placeholder', locale);
  applyStyles(nameInput, {
    flex: '1 1 auto',
    minWidth: '0',
    height: '34px',
    padding: '0 10px',
    border: '1px solid #D0D0D0',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  });
  form.appendChild(nameInput);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = getLabel('bidders_add', locale);
  applyStyles(submit, {
    ...ACTION_BUTTON_STYLES,
    marginTop: '0',
    padding: '0 12px',
    fontSize: '11px',
    whiteSpace: 'nowrap',
  });
  form.appendChild(submit);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const idValue = idInput.value;
    const nameValue = nameInput.value;
    if (idValue.trim() === '' || nameValue.trim() === '') return;
    submit.disabled = true;
    void addBidder(idValue, nameValue).finally(() => {
      idInput.value = '';
      nameInput.value = '';
      submit.disabled = false;
      idInput.focus();
    });
  });

  container.appendChild(form);

  // Own ID hint
  const ownIdHint = document.createElement('span');
  applyStyles(ownIdHint, { ...BREAKDOWN_STYLES, marginTop: '8px' });
  ownIdHint.textContent = getLabel('bidders_own_id_hint', locale);
  container.appendChild(ownIdHint);

  // Mapped list
  const entries = Object.entries(mapping).sort(([, a], [, b]) => a.localeCompare(b));

  if (entries.length === 0) {
    const empty = document.createElement('div');
    applyStyles(empty, { ...BREAKDOWN_STYLES, marginTop: '12px' });
    empty.textContent = getLabel('bidders_empty', locale);
    container.appendChild(empty);
    return container;
  }

  const list = document.createElement('div');
  applyStyles(list, {
    display: 'flex',
    flexDirection: 'column',
    marginTop: '12px',
  });
  container.appendChild(list);

  entries.forEach(([id, name]) => {
    const row = document.createElement('div');
    applyStyles(row, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 0',
      borderTop: '1px solid #EEEEEE',
    });

    const nameEl = document.createElement('span');
    applyStyles(nameEl, {
      flex: '1 1 auto',
      fontSize: '12px',
      fontWeight: '700',
      color: '#1A1A1A',
    });
    nameEl.textContent = name;
    row.appendChild(nameEl);

    const idEl = document.createElement('span');
    applyStyles(idEl, {
      fontSize: '11px',
      color: '#888',
      fontFamily: 'monospace',
    });
    idEl.textContent = `#${id}`;
    row.appendChild(idEl);

    const removeButton = createButton(getLabel('bidders_remove', locale), {
      border: '1px solid #D0D0D0',
      color: '#666',
    });
    removeButton.addEventListener('click', () => {
      removeButton.disabled = true;
      void removeBidder(id).catch(() => {
        removeButton.disabled = false;
      });
    });
    row.appendChild(removeButton);

    list.appendChild(row);
  });

  return container;
}

// --- Settings tab ---

function createSettingsTab(platform: Platform | null, locale: string): HTMLElement {
  const container = document.createElement('div');

  // Platform info
  const platformRow = document.createElement('div');
  applyStyles(platformRow, {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '12px',
    color: '#1A1A1A',
  });

  const platformLabel = document.createElement('span');
  applyStyles(platformLabel, TOTAL_LABEL_STYLES);
  platformLabel.textContent = 'Plataforma detectada';
  platformRow.appendChild(platformLabel);

  const platformValue = document.createElement('span');
  applyStyles(platformValue, { fontWeight: '700', fontSize: '14px' });
  platformValue.textContent = platform?.name ?? 'Desconocida';
  platformRow.appendChild(platformValue);

  container.appendChild(platformRow);

  // Version info
  const versionRow = document.createElement('div');
  applyStyles(versionRow, { marginTop: '14px' });

  const versionLabel = document.createElement('span');
  applyStyles(versionLabel, TOTAL_LABEL_STYLES);
  versionLabel.textContent = 'Version';
  versionRow.appendChild(versionLabel);

  const versionValue = document.createElement('span');
  applyStyles(versionValue, { display: 'block', fontSize: '12px', color: '#1A1A1A' });
  versionValue.textContent = `v${BUILD_INFO.version} (${BUILD_INFO.shortSha})`;
  versionRow.appendChild(versionValue);

  container.appendChild(versionRow);

  // Numista API key
  const apiRow = document.createElement('div');
  applyStyles(apiRow, { marginTop: '14px' });

  const apiLabel = document.createElement('span');
  applyStyles(apiLabel, TOTAL_LABEL_STYLES);
  apiLabel.textContent = 'Numista API Key';
  apiRow.appendChild(apiLabel);

  const apiStatus = document.createElement('span');
  applyStyles(apiStatus, { display: 'block', fontSize: '12px', color: '#888' });

  const storage = globalThis.chrome?.storage?.local;
  if (storage?.get) {
    storage.get('numista.apiKey', (items: Record<string, unknown>) => {
      const key = items['numista.apiKey'];
      apiStatus.textContent = typeof key === 'string' && key.length > 0
        ? `Configurada (${key.substring(0, 6)}...)`
        : 'No configurada';
    });
  } else {
    apiStatus.textContent = 'Storage no disponible';
  }

  apiRow.appendChild(apiStatus);
  container.appendChild(apiRow);

  // Supported platforms
  const platformsRow = document.createElement('div');
  applyStyles(platformsRow, { marginTop: '14px' });

  const platformsLabel = document.createElement('span');
  applyStyles(platformsLabel, TOTAL_LABEL_STYLES);
  platformsLabel.textContent = 'Plataformas soportadas';
  platformsRow.appendChild(platformsLabel);

  const platformsList = document.createElement('span');
  applyStyles(platformsList, { display: 'block', fontSize: '12px', color: '#1A1A1A' });
  platformsList.textContent = 'Catawiki · Wallapop';
  platformsRow.appendChild(platformsList);

  container.appendChild(platformsRow);

  return container;
}

// --- Main panel ---

function countActiveFilters(filters: ListingFilters): number {
  let count = 0;
  if (filters.onlyNoReserve) count++;
  if (filters.maxEstimatedTotal !== null) count++;
  if (filters.maxShipping !== null) count++;
  return count;
}

async function renderPanel(): Promise<void> {
  // Remove existing panel
  document.querySelectorAll(`[${EXT_ATTR}="control-panel"], [${EXT_ATTR}="control-fab"]`).forEach((el) => el.remove());

  const locale = currentPlatform?.detectLocale() ?? detectLocale();

  let filters: ListingFilters = { maxEstimatedTotal: null, maxShipping: null, onlyNoReserve: false };
  let ignoredLots: readonly IgnoredLotEntry[] = [];
  let bidderMapping: BidderMapping = {};

  try {
    [filters, ignoredLots, bidderMapping] = await Promise.all([
      getListingFilters(),
      getIgnoredLots(),
      getBidderMapping(),
    ]);
  } catch {
    // Continue with defaults
  }

  // If the bidders tab is active but not valid for this platform, fall back
  if (activeTab === 'bidders' && currentPlatform?.id !== 'catawiki') {
    activeTab = 'filters';
  }

  const filterCount = countActiveFilters(filters);

  // Always show the FAB
  const fab = createFAB(filterCount, ignoredLots.length);
  document.body.appendChild(fab);

  if (!panelOpen) return;

  // Build the panel
  const panel = createExtElement('div', 'control-panel');
  applyStyles(panel, {
    position: 'fixed',
    right: '16px',
    bottom: '64px',
    zIndex: '2147483645',
    width: 'min(360px, calc(100vw - 32px))',
    maxHeight: 'min(65vh, 560px)',
    overflowY: 'auto',
    padding: '14px 16px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #D7E3FF',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.14)',
    fontFamily: 'inherit',
  });

  // Header
  const header = document.createElement('div');
  applyStyles(header, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  });

  const title = document.createElement('span');
  applyStyles(title, {
    fontSize: '14px',
    fontWeight: '700',
    color: '#1A1A1A',
  });
  title.textContent = `CoinScope · ${currentPlatform?.name ?? '?'}`;
  header.appendChild(title);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  applyStyles(closeButton, {
    border: 'none',
    background: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#888',
    padding: '0 4px',
  });
  closeButton.textContent = '\u00D7';
  closeButton.addEventListener('click', () => {
    panelOpen = false;
    void renderPanel();
  });
  header.appendChild(closeButton);

  panel.appendChild(header);

  // Tab bar
  panel.appendChild(createTabBar(locale, currentPlatform));

  // Tab content
  if (activeTab === 'filters') {
    panel.appendChild(createFiltersTab(filters, locale));
  } else if (activeTab === 'ignored') {
    panel.appendChild(createIgnoredTab(ignoredLots, locale));
  } else if (activeTab === 'bidders') {
    panel.appendChild(createBiddersTab(bidderMapping, locale));
  } else if (activeTab === 'settings') {
    panel.appendChild(createSettingsTab(currentPlatform, locale));
  }

  document.body.appendChild(panel);
}

// --- Public API ---

export function injectControlPanel(platform: Platform): void {
  currentPlatform = platform;
  ensureStorageListener();
  void renderPanel();
}

/**
 * Remove old separate panels that are now unified in the control panel.
 */
export function removeOldPanels(): void {
  document.querySelectorAll(
    `[${EXT_ATTR}="listing-filters-panel"], [${EXT_ATTR}="ignored-lots-panel"]`,
  ).forEach((el) => el.remove());
}
