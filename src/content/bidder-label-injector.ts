import {
  getBidderMapping,
  getBidderMappingSync,
  onBidderMappingChange,
  type BidderMapping,
} from './bidder-mapping';

// Matches display labels like "Pujador 2943", "Bidder 8646", "Bieter 1185",
// "Enchérisseur 2383", "Bieder 641". Allows trailing/leading whitespace.
const BIDDER_LABEL_RE = /^\s*(Pujador|Bidder|Bieter|Enchérisseur|Bieder)\s+(\d+)\s*$/i;

interface AnnotationState {
  readonly original: string;
  readonly id: string;
}

const annotatedNodes = new WeakMap<Text, AnnotationState>();

let observer: MutationObserver | null = null;
let unsubscribeStorage: (() => void) | null = null;
let pendingAnnotation = false;

function buildReplacement(mapping: BidderMapping, textNode: Text): string | null {
  const existing = annotatedNodes.get(textNode);
  const currentText = textNode.textContent ?? '';

  let id: string;
  let original: string;

  if (existing) {
    id = existing.id;
    original = existing.original;
  } else {
    const match = BIDDER_LABEL_RE.exec(currentText);
    if (!match) return null;
    id = match[2];
    original = currentText;
  }

  const friendly = mapping[id];
  const expected = friendly ? `${friendly} (${original.trim()})` : original;

  if (!existing) {
    annotatedNodes.set(textNode, { original, id });
  }

  if (currentText === expected) return null;
  return expected;
}

export function annotateBidderLabels(
  mapping: BidderMapping = getBidderMappingSync(),
  root: ParentNode = document.body,
): void {
  if (!root) return;
  const base = root instanceof Document ? root.body : (root as Node);
  if (!base) return;

  const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT);
  const pending: Array<{ node: Text; text: string }> = [];

  let current: Node | null = walker.nextNode();
  while (current) {
    const textNode = current as Text;
    const replacement = buildReplacement(mapping, textNode);
    if (replacement !== null) {
      pending.push({ node: textNode, text: replacement });
    }
    current = walker.nextNode();
  }

  pending.forEach(({ node, text }) => {
    node.textContent = text;
  });
}

function scheduleAnnotation(): void {
  if (pendingAnnotation) return;
  pendingAnnotation = true;
  window.setTimeout(() => {
    pendingAnnotation = false;
    annotateBidderLabels(getBidderMappingSync());
  }, 300);
}

export function startBidderLabelObserver(): void {
  if (observer) return;

  void getBidderMapping().then((mapping) => {
    annotateBidderLabels(mapping);
  });

  unsubscribeStorage = onBidderMappingChange((mapping) => {
    annotateBidderLabels(mapping);
  });

  observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((m) => {
      if (m.type === 'characterData') {
        const text = m.target.textContent ?? '';
        return BIDDER_LABEL_RE.test(text);
      }
      return m.addedNodes.length > 0;
    });
    if (relevant) scheduleAnnotation();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

export function stopBidderLabelObserver(): void {
  observer?.disconnect();
  observer = null;
  unsubscribeStorage?.();
  unsubscribeStorage = null;
}
