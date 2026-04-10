import { describe, expect, it } from 'vitest';
import { extractLotCostDetailsFromHtml } from './lot-cost-resolver';

describe('extractLotCostDetailsFromHtml', () => {
  it('extracts shipping and commission from the detail page markup', () => {
    const details = extractLotCostDetailsFromHtml(`
      <div data-testid="buyer-protection-statement">Tarifa de la Protección del Comprador: 9% + € 3</div>
      <div data-testid="shipping-fee">€ 15</div>
    `);

    expect(details).toEqual({
      shippingCost: 15,
      commissionConfig: { rate: 0.09, fixedFee: 3 },
    });
  });

  it('recognizes free shipping in supported locales', () => {
    const details = extractLotCostDetailsFromHtml(`
      <div data-testid="buyer-protection-statement">Buyer Protection fee: 9% + € 3</div>
      <div data-testid="shipping-fee">Envío gratuito</div>
    `);

    expect(details).toEqual({
      shippingCost: 0,
      commissionConfig: { rate: 0.09, fixedFee: 3 },
    });
  });

  it('falls back to null shipping when the detail page does not expose it', () => {
    const details = extractLotCostDetailsFromHtml(`
      <div data-testid="buyer-protection-statement">Buyer Protection fee: 9% + € 3</div>
    `);

    expect(details).toEqual({
      shippingCost: null,
      commissionConfig: { rate: 0.09, fixedFee: 3 },
    });
  });

  it('extracts shipping from the text block when the DOM selector is missing', () => {
    const details = extractLotCostDetailsFromHtml(`
      <section>
        <h3>Gastos de envío</h3>
        <div>Envío a España: 15 €</div>
      </section>
      <div>Tarifa de la Protección del Comprador: 9% + € 3</div>
    `);

    expect(details).toEqual({
      shippingCost: 15,
      commissionConfig: { rate: 0.09, fixedFee: 3 },
    });
  });
});
