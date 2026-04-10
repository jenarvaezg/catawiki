import { LOT_DETAIL, queryWithFallback } from './dom-selectors';
import { injectLotDetailTotal, updateLotDetailTotal, setupModalObserver } from './lot-detail-injector';
import { injectLotDetailMarketWidget } from './lot-market-injector';
import { injectListingFiltersPanel } from './listing-filters-panel';
import { injectIgnoredLotsPanel } from './ignored-lots-panel';
import { injectListingTotals, updateListingTotals } from './listing-injector';
import { detectPageType } from './page-type';
import {
  setupPriceObserver,
  setupListingObserver,
  setupNavigationObserver,
  setupObserverHealthCheck,
} from './mutation-observer';
import { EXT_ATTR } from './styles';
import { injectUpdateNotifier } from './update-notifier';

let activeObservers: MutationObserver[] = [];
let activeIntervals: number[] = [];
let reinitializing = false;

function cleanupAll(): void {
  activeObservers.forEach((obs) => obs.disconnect());
  activeObservers = [];
  activeIntervals.forEach((id) => clearInterval(id));
  activeIntervals = [];
  document.querySelectorAll(`[${EXT_ATTR}]`).forEach((el) => el.remove());
}

function init(): void {
  try {
    const pageType = detectPageType(window.location.href);

    if (pageType !== 'unknown') {
      void injectListingFiltersPanel();
      void injectUpdateNotifier();
      void injectIgnoredLotsPanel();
    }

    if (pageType === 'lot-detail') {
      injectLotDetailTotal();
      injectLotDetailMarketWidget();
      injectListingTotals();

      // Watch for bid confirmation modal appearing
      const modalObs = setupModalObserver();
      activeObservers.push(modalObs);

      const relatedCardsObserver = setupListingObserver(() => updateListingTotals(), document.body);
      activeObservers.push(relatedCardsObserver);

      const bidSection = queryWithFallback(LOT_DETAIL.BID_SECTION);
      // Observe the parent bidding panel (covers bid section + quick bid buttons + other siblings)
      const observeTarget = bidSection?.parentElement ?? bidSection;
      if (observeTarget) {
        const obs = setupPriceObserver(observeTarget, () => {
          updateLotDetailTotal();
          injectLotDetailMarketWidget();
          updateListingTotals();
        });
        activeObservers.push(obs);

        const healthId = setupObserverHealthCheck(observeTarget, () => {
          if (reinitializing) return;
          reinitializing = true;
          cleanupAll();
          init();
          reinitializing = false;
        });
        activeIntervals.push(healthId);
      }
    } else if (pageType === 'listing') {
      injectListingTotals();
      const obs = setupListingObserver(() => updateListingTotals());
      activeObservers.push(obs);
    }
  } catch (e) {
    console.warn('[Catawiki Price Ext] Error during init:', e);
  }
}

// Initial run
init();

// SPA navigation — set up ONCE globally, survives cleanupAll()
setupNavigationObserver(() => {
  cleanupAll();
  init();
});
