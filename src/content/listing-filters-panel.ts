import { detectLocale, getLabel } from './i18n';
import { getListingFilters, resetListingFilters, setListingFilters, type ListingFilters } from './listing-filters';
import { updateListingTotals } from './listing-injector';
import {
  ACTION_BUTTON_STYLES,
  BREAKDOWN_STYLES,
  EXT_ATTR,
  TOTAL_AMOUNT_STYLES,
  TOTAL_LABEL_STYLES,
  applyStyles,
  createExtElement,
} from './styles';

let panelExpanded = false;
let storageListenerInstalled = false;

function createActionButton(label: string, overrides: Record<string, string> = {}): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  applyStyles(button, {
    ...ACTION_BUTTON_STYLES,
    marginTop: '0',
    padding: '6px 10px',
    fontSize: '11px',
    ...overrides,
  });
  button.textContent = label;
  return button;
}

function formatFilterSummary(filters: ListingFilters): string {
  const parts: string[] = [];
  if (filters.onlyNoReserve) parts.push('NR');
  if (filters.maxEstimatedTotal !== null) parts.push(`T<=${filters.maxEstimatedTotal}`);
  if (filters.maxShipping !== null) parts.push(`S<=${filters.maxShipping}`);
  return parts.length > 0 ? parts.join(' · ') : '0';
}

function parseNumberInput(input: HTMLInputElement): number | null {
  const value = input.value.trim();
  if (value === '') return null;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function ensureStorageListener(): void {
  if (storageListenerInstalled) return;

  const onChanged = globalThis.chrome?.storage?.onChanged;
  if (!onChanged?.addListener) return;

  onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !('listingFilters.v1' in changes)) return;
    void injectListingFiltersPanel();
    updateListingTotals();
  });

  storageListenerInstalled = true;
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

function createListingFiltersPanel(filters: ListingFilters, locale: string): HTMLElement {
  const root = createExtElement('div', 'listing-filters-panel');
  applyStyles(root, {
    position: 'fixed',
    left: '16px',
    bottom: '84px',
    zIndex: '2147483645',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '10px',
    fontFamily: 'inherit',
  });

  const toggleButton = createActionButton(
    `${getLabel('listing_filters_manage', locale)} (${formatFilterSummary(filters)})`,
    {
      border: '1px solid #D7E3FF',
      backgroundColor: '#FFFFFF',
      color: '#0033FF',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    },
  );
  toggleButton.addEventListener('click', () => {
    panelExpanded = !panelExpanded;
    void injectListingFiltersPanel();
  });
  root.appendChild(toggleButton);

  if (!panelExpanded) {
    return root;
  }

  const panel = document.createElement('div');
  applyStyles(panel, {
    width: 'min(320px, calc(100vw - 32px))',
    padding: '12px 14px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #D7E3FF',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  });
  root.appendChild(panel);

  const label = document.createElement('span');
  applyStyles(label, TOTAL_LABEL_STYLES);
  label.textContent = getLabel('listing_filters_title', locale);
  panel.appendChild(label);

  const amount = document.createElement('span');
  applyStyles(amount, TOTAL_AMOUNT_STYLES);
  amount.style.fontSize = '14px';
  amount.textContent = formatFilterSummary(filters);
  panel.appendChild(amount);

  const hint = document.createElement('span');
  applyStyles(hint, BREAKDOWN_STYLES);
  hint.textContent = getLabel('listing_filters_hint', locale);
  panel.appendChild(hint);

  const fields = document.createElement('div');
  applyStyles(fields, {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '12px',
  });
  panel.appendChild(fields);

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

  const totalField = buildNumberField(getLabel('listing_filters_max_total', locale), filters.maxEstimatedTotal);
  fields.appendChild(totalField.wrapper);

  const shippingField = buildNumberField(getLabel('listing_filters_max_shipping', locale), filters.maxShipping);
  fields.appendChild(shippingField.wrapper);

  const persistFilters = async () => {
    await setListingFilters({
      onlyNoReserve: reserveCheckbox.checked,
      maxEstimatedTotal: parseNumberInput(totalField.input),
      maxShipping: parseNumberInput(shippingField.input),
    });
  };

  reserveCheckbox.addEventListener('change', () => {
    void persistFilters();
  });
  totalField.input.addEventListener('change', () => {
    void persistFilters();
  });
  shippingField.input.addEventListener('change', () => {
    void persistFilters();
  });

  const resetButton = createActionButton(getLabel('listing_filters_reset', locale), {
    border: '1px solid #D0D0D0',
    color: '#666',
    marginTop: '12px',
  });
  resetButton.addEventListener('click', () => {
    void resetListingFilters();
  });
  panel.appendChild(resetButton);

  return root;
}

export async function injectListingFiltersPanel(): Promise<void> {
  ensureStorageListener();

  document.querySelectorAll(`[${EXT_ATTR}="listing-filters-panel"]`).forEach((node) => node.remove());

  try {
    const filters = await getListingFilters();
    const panel = createListingFiltersPanel(filters, detectLocale());
    document.body.appendChild(panel);
  } catch (error) {
    console.warn('[Catawiki Price Ext] Failed to render listing filters panel:', error);
  }
}
