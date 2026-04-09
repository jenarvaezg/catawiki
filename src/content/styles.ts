const EXT_ATTR = 'data-catawiki-ext';

export { EXT_ATTR };

export const WIDGET_STYLES: Record<string, string> = {
  display: 'block',
  margin: '8px 0 12px 0',
  padding: '8px 12px',
  backgroundColor: '#F5F5F5',
  borderRadius: '4px',
  borderLeft: '3px solid #0033FF',
  fontFamily: 'inherit',
  lineHeight: '1.4',
};

export const TOTAL_LABEL_STYLES: Record<string, string> = {
  display: 'block',
  fontSize: '11px',
  color: '#666',
  marginBottom: '2px',
  fontWeight: 'normal',
};

export const TOTAL_AMOUNT_STYLES: Record<string, string> = {
  display: 'block',
  fontSize: '16px',
  fontWeight: '700',
  color: '#1A1A1A',
};

export const BREAKDOWN_STYLES: Record<string, string> = {
  display: 'block',
  fontSize: '11px',
  color: '#888',
  marginTop: '2px',
};

export const CARD_TOTAL_STYLES: Record<string, string> = {
  display: 'block',
  fontSize: '12px',
  color: '#666',
  marginTop: '2px',
  fontWeight: 'normal',
};

export const QUICK_BID_TOTAL_STYLES: Record<string, string> = {
  display: 'block',
  fontSize: '9px',
  color: '#888',
  marginTop: '0px',
  fontWeight: 'normal',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  lineHeight: '1.2',
};

export function applyStyles(el: HTMLElement, styles: Record<string, string>): void {
  for (const [key, value] of Object.entries(styles)) {
    const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    el.style.setProperty(kebab, value);
  }
}

export function createExtElement(tag: string, extValue: string): HTMLElement {
  const el = document.createElement(tag);
  el.setAttribute(EXT_ATTR, extValue);
  return el;
}
