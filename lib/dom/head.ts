//  Merge new head data with current head data
export function mergeHead(nextDoc: Document): void {
  // Update head
  // Head elements that changed on next document
  const oldNodes = getHeadNodesWithoutPrefetch(document);
  const nextNodes = getHeadNodesWithoutPrefetch(nextDoc);
  const { staleNodes, freshNodes } = partitionNodes(oldNodes, nextNodes);

  staleNodes.forEach((node) => node.remove());

  document.head.append(...freshNodes);
}

// Find all head nodes without rel=prefetch
function getHeadNodesWithoutPrefetch(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll('head>:not([rel="prefetch"]'));
}

// Partition nodes into stale and fresh nodes
function partitionNodes(
  oldNodes: Element[],
  nextNodes: Element[],
): {
  freshNodes: Element[];
  staleNodes: Element[];
} {
  const staleNodes: Element[] = [];
  const freshNodes: Element[] = [];

  let oldMark = 0;
  let nextMark = 0;

  while (oldMark < oldNodes.length || nextMark < nextNodes.length) {
    const old = oldNodes[oldMark];
    const next = nextNodes[nextMark];
    if (old?.isEqualNode(next)) {
      oldMark++;
      nextMark++;
      continue;
    }

    const oldInFresh = old ? freshNodes.findIndex((node) => node.isEqualNode(old)) : -1;
    if (oldInFresh !== -1) {
      freshNodes.splice(oldInFresh, 1);
      oldMark++;
      continue;
    }

    const nextInStale = next ? staleNodes.findIndex((node) => node.isEqualNode(next)) : -1;
    if (nextInStale !== -1) {
      staleNodes.splice(nextInStale, 1);
      nextMark++;
      continue;
    }

    old && staleNodes.push(old);
    next && freshNodes.push(next);

    oldMark++;
    nextMark++;
  }

  return { staleNodes, freshNodes };
}
