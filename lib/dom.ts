// Convert any HTML string to new Document
export function htmlStringToDocument(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

// Replace Body with a new body, but keep nodes with flamerouter-preserve attr
export function replaceBody(nextDoc: Document): void {
  const nodesToPreserve = document.body.querySelectorAll('[flamerouter-preserve]');
  nodesToPreserve.forEach((nodeToPreserve) => {
    const nextDocNode = nextDoc.body.querySelector('[flamerouter-preserve][id="' + nodeToPreserve.id + '"]');
    if (!nextDocNode) return;

    const clone = nodeToPreserve.cloneNode(true);
    nextDocNode.replaceWith(clone);
  });

  document.body.replaceWith(nextDoc.body);
}

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

/**
 * Runs JS in the fetched document
 * head scripts will only run with data-reload attr
 * all body scripts will run
 */
export function runScripts(): void {
  // Run scripts with data-reload attr
  const headScripts = document.head.querySelectorAll('script[data-reload]') as NodeListOf<HTMLScriptElement>;
  headScripts.forEach(replaceAndRunScript);

  // Run scripts in body
  const bodyScripts = document.body.querySelectorAll('script');
  bodyScripts.forEach(replaceAndRunScript);
}

// Private helper to re-execute scripts
function replaceAndRunScript(oldScript: HTMLScriptElement): void {
  const newScript = document.createElement('script');
  const attrs = Array.from(oldScript.attributes);
  for (const { name, value } of attrs) {
    newScript[name] = value;
  }
  newScript.append(oldScript.textContent ?? '');
  oldScript.replaceWith(newScript);
}
