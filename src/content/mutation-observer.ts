function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

function isOwnMutation(mutations: MutationRecord[]): boolean {
  return mutations.every((m) => {
    // Check if the target itself is one of our elements
    const target = m.target instanceof Element ? m.target : m.target.parentElement;
    if (target?.hasAttribute('data-catawiki-ext')) return true;
    // Check if only our elements were added/removed
    const addedOwn = Array.from(m.addedNodes).every(
      (n) => n instanceof Element && n.hasAttribute('data-catawiki-ext'),
    );
    const removedOwn = Array.from(m.removedNodes).every(
      (n) => n instanceof Element && n.hasAttribute('data-catawiki-ext'),
    );
    if ((m.addedNodes.length > 0 || m.removedNodes.length > 0) && addedOwn && removedOwn) return true;
    return false;
  });
}

export function setupPriceObserver(
  target: Element,
  callback: () => void,
): MutationObserver {
  const debouncedCallback = debounce(callback, 300);
  const observer = new MutationObserver((mutations) => {
    // Skip mutations caused by our own injected elements
    if (isOwnMutation(mutations)) return;
    debouncedCallback();
  });
  observer.observe(target, {
    characterData: true,
    childList: true,
    subtree: true,
  });
  return observer;
}

export function setupListingObserver(
  callback: () => void,
  target: Element = document.querySelector('[data-testid="lots-grid"]') ?? document.body,
): MutationObserver {
  const debouncedCallback = debounce(callback, 500);
  const observer = new MutationObserver((mutations) => {
    if (isOwnMutation(mutations)) return;
    debouncedCallback();
  });
  observer.observe(target, {
    childList: true,
    subtree: true,
  });
  return observer;
}

let navigationObserverInstalled = false;

export function setupNavigationObserver(
  callback: (url: string) => void,
): void {
  if (navigationObserverInstalled) return;
  navigationObserverInstalled = true;

  let lastUrl = window.location.href;

  const onUrlChange = () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      callback(currentUrl);
    }
  };

  // Intercept history.pushState
  const originalPushState = history.pushState.bind(history);
  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    originalPushState(...args);
    onUrlChange();
  };

  // Intercept history.replaceState
  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    originalReplaceState(...args);
    onUrlChange();
  };

  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', onUrlChange);

  // URL polling fallback (catches any navigation mechanism we missed)
  setInterval(onUrlChange, 1500);
}

export function setupObserverHealthCheck(
  target: Element,
  reinitCallback: () => void,
): number {
  return window.setInterval(() => {
    if (!target.isConnected) {
      reinitCallback();
    }
  }, 3000);
}
