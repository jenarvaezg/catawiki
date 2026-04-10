/**
 * Wallapop Envíos shipping cost tiers.
 *
 * Wallapop charges buyers for shipping via "Wallapop Envíos".
 * Costs are based on package size/weight tiers.
 * These are approximate and may vary.
 */

export interface ShippingTier {
  readonly label: string;
  readonly maxWeightKg: number;
  readonly cost: number;
}

export const WALLAPOP_SHIPPING_TIERS: readonly ShippingTier[] = [
  { label: 'Pequeño', maxWeightKg: 1, cost: 2.50 },
  { label: 'Mediano', maxWeightKg: 5, cost: 3.95 },
  { label: 'Grande', maxWeightKg: 10, cost: 5.95 },
  { label: 'Muy grande', maxWeightKg: 30, cost: 8.95 },
] as const;

/**
 * Returns the minimum and maximum possible shipping cost.
 * Useful when the exact weight is unknown.
 */
export function getShippingRange(): { readonly min: number; readonly max: number } {
  return {
    min: WALLAPOP_SHIPPING_TIERS[0].cost,
    max: WALLAPOP_SHIPPING_TIERS[WALLAPOP_SHIPPING_TIERS.length - 1].cost,
  };
}

/**
 * Coins are almost always in the smallest tier.
 */
export function getDefaultCoinShippingEstimate(): number {
  return WALLAPOP_SHIPPING_TIERS[0].cost;
}
