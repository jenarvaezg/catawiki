import { LOT_DETAIL, queryWithFallback } from './dom-selectors';
import { injectLotDetailTotal, updateLotDetailTotal, setupModalObserver } from './lot-detail-injector';
import { injectLotDetailMarketWidget } from './lot-market-injector';
import { injectControlPanel, removeOldPanels } from './control-panel';
import { injectDetailTotal } from './detail-total-injector';
import { injectListingTotals, updateListingTotals } from './listing-injector';
import {
  setupPriceObserver,
  setupListingObserver,
  setupNavigationObserver,
  setupObserverHealthCheck,
} from './mutation-observer';
import { EXT_ATTR } from './styles';
import { injectUpdateNotifier } from './update-notifier';
import { startBidderLabelObserver } from './bidder-label-injector';
import { detectPlatform } from '../platforms/registry';
import type { Platform } from '../platforms/platform';

let activeObservers: MutationObserver[] = [];
let activeIntervals: number[] = [];
let reinitializing = false;
let currentPlatform: Platform | null = null;

function cleanupAll(): void {
  activeObservers.forEach((obs) => obs.disconnect());
  activeObservers = [];
  activeIntervals.forEach((id) => clearInterval(id));
  activeIntervals = [];
  document.querySelectorAll(`[${EXT_ATTR}]`).forEach((el) => el.remove());
}

function init(): void {
  try {
    currentPlatform = detectPlatform(window.location.href);
    if (!currentPlatform) return;

    const pageType = currentPlatform.detectPageType(window.location.href);

    if (pageType !== 'unknown') {
      removeOldPanels();
      injectControlPanel(currentPlatform);
      void injectUpdateNotifier();
    }

    if (currentPlatform.id === 'catawiki') {
      // Globally observes bidder labels (e.g. "Pujador 2943") and replaces
      // them with user-defined friendly names. Runs once; observer survives SPA
      // navigations so cleanupAll does not tear it down.
      startBidderLabelObserver();
    }

    if (pageType === 'lot-detail') {
      // Catawiki-specific auction detail features (bid totals, modals, quick bids)
      if (currentPlatform.id === 'catawiki') {
        injectLotDetailTotal();

        const modalObs = setupModalObserver();
        activeObservers.push(modalObs);

        const bidSection = queryWithFallback(LOT_DETAIL.BID_SECTION);
        const observeTarget = bidSection?.parentElement ?? bidSection;
        if (observeTarget) {
          const obs = setupPriceObserver(observeTarget, () => {
            updateLotDetailTotal();
            injectLotDetailMarketWidget(currentPlatform!);
            updateListingTotals(currentPlatform!);
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
      }

      // Generic detail total widget for non-auction platforms (Wallapop, Vinted)
      if (currentPlatform.id !== 'catawiki') {
        injectDetailTotal(currentPlatform);
      }

      // Market widgets (Numista + bullion) — all platforms
      injectLotDetailMarketWidget(currentPlatform);

      // Related lots on detail pages — all platforms
      injectListingTotals(currentPlatform);
      const relatedCardsObserver = setupListingObserver(() => updateListingTotals(currentPlatform!), document.body);
      activeObservers.push(relatedCardsObserver);

    } else if (pageType === 'listing') {
      injectListingTotals(currentPlatform);
      const obs = setupListingObserver(() => updateListingTotals(currentPlatform!));
      activeObservers.push(obs);
    }
  } catch (e) {
    console.warn('[CoinScope Ext] Error during init:', e);
  }
}

// Initial run
init();

// SPA navigation — set up ONCE globally, survives cleanupAll()
setupNavigationObserver(() => {
  cleanupAll();
  init();
});
