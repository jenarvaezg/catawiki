import { detectLocale, getLabel } from './i18n';
import { getIgnoredLots, unignoreLot, type IgnoredLotEntry } from './ignored-lots';
import {
  ACTION_BUTTON_STYLES,
  BREAKDOWN_STYLES,
  EXT_ATTR,
  LINK_STYLES,
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

function ensureStorageListener(): void {
  if (storageListenerInstalled) return;

  const onChanged = globalThis.chrome?.storage?.onChanged;
  if (!onChanged?.addListener) return;

  onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!('ignoredLots.v2' in changes) && !('ignoredLotIds.v1' in changes)) return;
    void injectIgnoredLotsPanel();
  });

  storageListenerInstalled = true;
}

function createIgnoredLotsPanel(lots: readonly IgnoredLotEntry[], locale: string): HTMLElement {
  const root = createExtElement('div', 'ignored-lots-panel');
  applyStyles(root, {
    position: 'fixed',
    left: '16px',
    bottom: '16px',
    zIndex: '2147483646',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '10px',
    fontFamily: 'inherit',
  });

  const toggleButton = createActionButton(`${getLabel('ignored_lots_manage', locale)} (${lots.length})`, {
    border: '1px solid #D7E3FF',
    backgroundColor: '#FFFFFF',
    color: '#0033FF',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  });
  toggleButton.addEventListener('click', () => {
    panelExpanded = !panelExpanded;
    void injectIgnoredLotsPanel();
  });
  root.appendChild(toggleButton);

  if (!panelExpanded) {
    return root;
  }

  const panel = document.createElement('div');
  applyStyles(panel, {
    width: 'min(360px, calc(100vw - 32px))',
    maxHeight: 'min(60vh, 520px)',
    overflowY: 'auto',
    padding: '12px 14px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #D7E3FF',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  });
  root.appendChild(panel);

  const label = document.createElement('span');
  applyStyles(label, TOTAL_LABEL_STYLES);
  label.textContent = getLabel('ignored_lots_title', locale);
  panel.appendChild(label);

  const amount = document.createElement('span');
  applyStyles(amount, TOTAL_AMOUNT_STYLES);
  amount.style.fontSize = '14px';
  amount.textContent = `${lots.length}`;
  panel.appendChild(amount);

  const hint = document.createElement('span');
  applyStyles(hint, BREAKDOWN_STYLES);
  hint.textContent = getLabel('ignored_lots_reload_hint', locale);
  panel.appendChild(hint);

  if (lots.length === 0) {
    const empty = document.createElement('div');
    applyStyles(empty, {
      ...BREAKDOWN_STYLES,
      marginTop: '12px',
    });
    empty.textContent = getLabel('ignored_lots_empty', locale);
    panel.appendChild(empty);
    return root;
  }

  const list = document.createElement('div');
  applyStyles(list, {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '12px',
  });
  panel.appendChild(list);

  lots.forEach((lot) => {
    const item = document.createElement('div');
    applyStyles(item, {
      paddingTop: '10px',
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
    applyStyles(meta, {
      ...BREAKDOWN_STYLES,
      marginTop: '4px',
    });
    meta.textContent = `${lot.lotId} · ${new Date(lot.ignoredAt).toLocaleString(locale)}`;
    item.appendChild(meta);

    const actions = document.createElement('div');
    applyStyles(actions, {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      marginTop: '8px',
    });

    const openLink = document.createElement('a');
    openLink.href = lot.lotUrl;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    applyStyles(openLink, {
      ...LINK_STYLES,
      fontSize: '11px',
      alignSelf: 'center',
    });
    openLink.textContent = getLabel('ignored_lots_open', locale);
    actions.appendChild(openLink);

    const restoreButton = createActionButton(getLabel('ignored_lots_restore', locale), {
      border: '1px solid #D0D0D0',
      color: '#666',
    });
    restoreButton.addEventListener('click', () => {
      restoreButton.disabled = true;
      void unignoreLot(lot.lotId).catch((error) => {
        restoreButton.disabled = false;
        console.warn('[CoinScope] Failed to restore ignored lot:', lot.lotId, error);
      });
    });
    actions.appendChild(restoreButton);

    item.appendChild(actions);
    list.appendChild(item);
  });

  return root;
}

export async function injectIgnoredLotsPanel(): Promise<void> {
  ensureStorageListener();

  document.querySelectorAll(`[${EXT_ATTR}="ignored-lots-panel"]`).forEach((node) => node.remove());

  try {
    const lots = await getIgnoredLots();
    if (lots.length === 0) {
      panelExpanded = false;
      return;
    }

    const panel = createIgnoredLotsPanel(lots, detectLocale());
    document.body.appendChild(panel);
  } catch (error) {
    console.warn('[CoinScope] Failed to render ignored lots panel:', error);
  }
}
