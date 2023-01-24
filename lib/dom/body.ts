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
