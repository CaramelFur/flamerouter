import { RouteChangeData, TransitionType } from './interfaces';
import { fullURL } from './urls';

// Handles page back and page forward
export function handlePopState(_: PopStateEvent): RouteChangeData {
  const { target: next, id: scrollId } = fullURL();
  return { type: TransitionType.Popstate, next, scrollId };
}

export function handleMouseClick(e: MouseEvent): RouteChangeData {
  if (isHoldingSpecialKey(e)) return { type: TransitionType.Noop };

  const anchor = getParentAnchor(e.target as HTMLElement);
  if (!anchor) return { type: TransitionType.Noop };

  if (isExternalLink(anchor)) {
    anchor.target = '_blank';
    return { type: TransitionType.Noop };
  }

  if (isLinkOptOut(anchor)) return { type: TransitionType.Noop };

  const ahref = anchor.getAttribute('href');
  if (!ahref) return { type: TransitionType.Noop };

  const url = new URL(ahref, location.href);
  e.preventDefault();

  // TODO: improve
  if (ahref.startsWith('#')) {
    return { type: TransitionType.Scroll, scrollId: ahref };
  }

  const { target: next, id: scrollId } = fullURL(url.href);
  const { target: prev } = fullURL();

  return { type: TransitionType.Link, next, prev, scrollId };
}

function isHoldingSpecialKey(e: MouseEvent): boolean {
  return e.altKey || e.ctrlKey || e.metaKey || e.shiftKey;
}

function isExternalLink(node: HTMLAnchorElement): boolean {
  return node.host !== location.host;
}

function isLinkOptOut(node: HTMLElement): boolean {
  return 'cold' in node.dataset;
}

function getParentAnchor(node: HTMLElement): HTMLAnchorElement | null {
  if (node.nodeName === 'A') return node as HTMLAnchorElement;
  if (node.parentNode) return getParentAnchor(node.parentNode as HTMLElement);
  return null;
}
