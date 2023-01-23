import { htmlStringToDocument, mergeHead, replaceBody, runScripts } from './dom';
import { handleMouseClick, handlePopState } from './handlers';
import { FlamethrowerOptions, RouteChangeData, TransitionType } from './interfaces';
import { responseToProgressStream } from './progress';
import { fullURL } from './urls';

type ModernDocument = Document & {
  createDocumentTransition?: () => {
    start: (cb: () => void) => void;
  };
};

type LinkElement = HTMLAnchorElement | HTMLAreaElement;

export class Router {
  private readonly prefetched = new Set<string>();
  private readonly opts: FlamethrowerOptions;

  private observer: IntersectionObserver | undefined;

  public enabled = true;

  constructor(opts: FlamethrowerOptions) {
    this.opts = opts;

    if (!window?.history) {
      console.warn('flamethrower router not supported in this browser or environment');
      this.enabled = false;
      return;
    }

    document.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('popstate', (e) => this.onPop(e));

    this.prefetch();
  }

  // Navigate to a url
  public go(path: string): Promise<boolean> {
    const prev = window.location.href;
    const { target: next, id: scrollId } = fullURL(path, location.origin);
    return this.reconstructDOM({ type: TransitionType.Link, next, prev, scrollId });
  }

  public back(): void {
    window.history.back();
  }

  public forward(): void {
    window.history.forward();
  }

  // Find all links on page
  private getAllLinks(): LinkElement[] {
    return Array.from(document.links).filter((node) => {
      const url = new URL(node.href);
      if (url.origin !== location.origin) return false;
      return url.href !== location.href && url.href !== location.href + '/';
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log(...args: any[]): void {
    this.opts.log && console.log(...args);
  }

  // Check if the route is qualified for prefetching and prefetch it with chosen method
  private prefetch(): void {
    if (this.opts.prefetch === 'visible') return this.prefetchVisible();
    if (this.opts.prefetch === 'hover') return this.prefetchOnHover();
  }

  // Finds links on page and prefetches them on hover
  private prefetchOnHover(): void {
    this.getAllLinks().forEach((node) => {
      // Using `pointerenter` instead of `mouseenter` to support touch devices hover behavior, PS: `pointerenter` event fires only once
      node.addEventListener('pointerenter', () => this.addLinkPrefetch(node.href), { once: true });
    });
  }

  // Prefetch all visible links
  private prefetchVisible(): void {
    if (!('IntersectionObserver' in window)) return;

    const intersectionOpts = {
      root: null,
      rootMargin: '0px',
      threshold: 1.0,
    };

    this.observer ??= new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        this.addLinkPrefetch((entry.target as LinkElement).href);
        observer.unobserve(entry.target);
      });
    }, intersectionOpts);

    this.getAllLinks().forEach((node) => this.observer?.observe(node));
  }

  // Create a link to prefetch
  private addLinkPrefetch(url: string): void {
    if (this.prefetched.has(url)) return;

    const linkEl = document.createElement('link');
    linkEl.rel = 'prefetch';
    linkEl.href = url;
    linkEl.as = 'document';

    linkEl.onload = () => this.log('🌩️ prefetched', url);
    // eslint-disable-next-line quotes
    linkEl.onerror = (err) => this.log("🤕 can't prefetch", url, err);

    document.head.appendChild(linkEl);

    // Keep track of prefetched links
    this.prefetched.add(url);
  }

  // Handle clicks on links
  private onClick(e: MouseEvent): void {
    this.reconstructDOM(handleMouseClick(e));
  }

  // Handle popstate events like back/forward buttons
  private onPop(e: PopStateEvent): void {
    this.reconstructDOM(handlePopState(e));
  }

  // Main process for reconstructing the DOM
  private async reconstructDOM(routeChangeData: RouteChangeData): Promise<boolean> {
    if (!this.enabled) {
      this.log('router disabled');
      return false;
    }

    try {
      this.log('⚡', routeChangeData.type);

      return await this.reconstructDOMUnsafe(routeChangeData);
    } catch (err) {
      window.dispatchEvent(new CustomEvent('flamerouter:error', err instanceof Error ? { detail: err } : undefined));

      this.opts.log && console.timeEnd('⏱️');
      console.error('💥 router fetch failed', err);
      return false;
    }
  }

  private async reconstructDOMUnsafe(routeChangeData: RouteChangeData): Promise<boolean> {
    // Check type && window href destination
    // Disqualify if fetching same URL
    if (routeChangeData.type === TransitionType.Noop) return false;
    if (routeChangeData.type === TransitionType.Scroll) {
      scrollTo(routeChangeData.type, routeChangeData.scrollId);
      return false;
    }

    if (routeChangeData.next === routeChangeData.prev) return false;

    const { type, next, scrollId } = routeChangeData;

    this.opts.log && console.time('⏱️');

    window.dispatchEvent(new CustomEvent('flamerouter:fetch'));

    // Update window history
    if (type !== TransitionType.Popstate) addToPushState(next);

    // Fetch next document
    const res = await fetch(next, { headers: { 'X-FlameRouter': '1' } })
      .then((res) => responseToProgressStream(res))
      .then((stream) => new Response(stream, { headers: { 'Content-Type': 'text/html' } }));

    const html = await res.text();
    const nextDoc = htmlStringToDocument(html);

    // Merge HEAD
    mergeHead(nextDoc);

    // Merge BODY
    const merge = (): void => {
      replaceBody(nextDoc);
      runScripts();
      scrollTo(type, scrollId);
    };

    // with optional native browser page transitions
    const modernDoc = document as ModernDocument;
    if (this.opts.pageTransitions && modernDoc.createDocumentTransition) {
      const transition = modernDoc.createDocumentTransition();
      transition.start(merge);
    } else {
      merge();
    }

    window.dispatchEvent(new CustomEvent('flamerouter:end'));

    // delay for any js rendered links
    setTimeout(() => {
      this.prefetch();
    }, 200);

    this.opts.log && console.timeEnd('⏱️');

    return true;
  }
}

// Writes URL to browser history
export function addToPushState(url: string): void {
  if (!window.history.state || window.history.state.url !== url) {
    window.history.pushState({ url }, 'internalLink', url);
  }
}

// scroll to position on next page
export function scrollTo(type: TransitionType, id: string | null): void {
  if (type !== TransitionType.Link) return;

  const el = id ? document.querySelector(id) : null;
  if (!el) return window.scrollTo({ top: 0 });

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
