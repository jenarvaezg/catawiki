import { detectLocale, getLabel } from './i18n';
import {
  ACTION_BUTTON_STYLES,
  BREAKDOWN_STYLES,
  EXT_ATTR,
  SECONDARY_META_STYLES,
  TOTAL_AMOUNT_STYLES,
  TOTAL_LABEL_STYLES,
  applyStyles,
  createExtElement,
} from './styles';
import type { CheckExtensionUpdateResponse } from '../shared/messages';
import type { ExtensionUpdateState } from '../shared/update';

const UPDATE_DISMISS_KEY = 'extension.update.dismissedTag';

function runtimeSendMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.sendMessage) {
      reject(new Error('Extension messaging unavailable'));
      return;
    }

    runtime.sendMessage(message, (response: T) => {
      const runtimeError = globalThis.chrome?.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message ?? 'Runtime messaging failed'));
        return;
      }

      resolve(response);
    });
  });
}

function getStorageArea() {
  return globalThis.chrome?.storage?.local;
}

function getStorageValue<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    const storage = getStorageArea();
    if (!storage?.get) {
      resolve(undefined);
      return;
    }

    storage.get(key, (items) => {
      resolve(items?.[key] as T | undefined);
    });
  });
}

function setStorageValue(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    const storage = getStorageArea();
    if (!storage?.set) {
      resolve();
      return;
    }

    storage.set({ [key]: value }, () => resolve());
  });
}

function formatVersionSummary(update: ExtensionUpdateState): string {
  const current = `${update.currentVersion} (${update.currentSha})`;
  const latestVersion = update.latestVersion ?? update.currentVersion;
  const latestSha = update.latestSha ?? update.latestTag ?? '';
  const latest = latestSha ? `${latestVersion} (${latestSha})` : latestVersion;
  return `${current} -> ${latest}`;
}

function createUpdateBanner(update: ExtensionUpdateState, locale: string): HTMLElement {
  const root = createExtElement('div', 'update-banner');
  applyStyles(root, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: '2147483647',
    width: 'min(360px, calc(100vw - 32px))',
    padding: '12px 14px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #D7E3FF',
    borderLeft: '4px solid #0033FF',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    fontFamily: 'inherit',
  });

  const label = document.createElement('span');
  applyStyles(label, TOTAL_LABEL_STYLES);
  label.textContent = getLabel('update_available', locale);
  root.appendChild(label);

  const amount = document.createElement('span');
  applyStyles(amount, TOTAL_AMOUNT_STYLES);
  amount.style.fontSize = '14px';
  amount.textContent = formatVersionSummary(update);
  root.appendChild(amount);

  const details = document.createElement('span');
  applyStyles(details, BREAKDOWN_STYLES);
  details.textContent = getLabel('update_manual_hint', locale);
  root.appendChild(details);

  const metaParts = [];
  if (update.latestTag) metaParts.push(update.latestTag);
  if (update.publishedAt) metaParts.push(new Date(update.publishedAt).toLocaleString(locale));

  if (metaParts.length > 0) {
    const meta = document.createElement('span');
    applyStyles(meta, SECONDARY_META_STYLES);
    meta.textContent = metaParts.join(' · ');
    root.appendChild(meta);
  }

  const actions = document.createElement('div');
  applyStyles(actions, {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '10px',
  });
  root.appendChild(actions);

  const openButton = document.createElement('button');
  openButton.type = 'button';
  applyStyles(openButton, ACTION_BUTTON_STYLES);
  openButton.textContent = getLabel('update_open_release', locale);
  openButton.addEventListener('click', () => {
    if (update.url) {
      window.open(update.url, '_blank', 'noopener,noreferrer');
    }
  });
  actions.appendChild(openButton);

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  applyStyles(dismissButton, {
    ...ACTION_BUTTON_STYLES,
    border: '1px solid #D0D0D0',
    color: '#666',
  });
  dismissButton.textContent = getLabel('update_dismiss', locale);
  dismissButton.addEventListener('click', () => {
    if (update.latestTag) {
      void setStorageValue(UPDATE_DISMISS_KEY, update.latestTag);
    }
    root.remove();
  });
  actions.appendChild(dismissButton);

  return root;
}

export async function injectUpdateNotifier(): Promise<void> {
  if (document.querySelector(`[${EXT_ATTR}="update-banner"]`)) return;

  try {
    const response = await runtimeSendMessage<CheckExtensionUpdateResponse>({
      type: 'check-extension-update',
    });

    if (!response.ok || response.result.status !== 'update-available' || !response.result.latestTag) {
      return;
    }

    const dismissedTag = await getStorageValue<string>(UPDATE_DISMISS_KEY);
    if (dismissedTag === response.result.latestTag) return;

    const banner = createUpdateBanner(response.result, detectLocale());
    document.body.appendChild(banner);
  } catch (error) {
    console.warn('[CoinScope] Failed to check extension update status:', error);
  }
}
