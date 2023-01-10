import { formatNextDocument, mergeHead, replaceBody, runScripts } from './dom';
import { addToPushState, handleLinkClick, handlePopState, scrollTo } from './handlers';
import { FetchProgressEvent, FlamethrowerOptions, RouteChangeData } from './interfaces';

type ModernDocument = Document & {
  createDocumentTransition?: () => {
    start: (cb: () => void) => void;
  };
};

const defaultOpts = {
  log: false,
  pageTransitions: false,
};

export class Router {
  public enabled = true;
  private prefetched = new Set<string>();
  private observer: IntersectionObserver | undefined;

  constructor(public opts?: FlamethrowerOptions) {
    this.opts = { ...defaultOpts, ...(opts ?? {}) };

    if (window?.history) {
      document.addEventListener('click', (e) => this.onClick(e));
      window.addEventListener('popstate', (e) => this.onPop(e));
      this.prefetch();
    } else {
      console.warn('flamethrower router not supported in this browser or environment');
      this.enabled = false;
    }
  }

  /**
   * @param  {string} path
   * Navigate to a url
   */
  public go(path: string): Promise<boolean> {
    const prev = window.location.href;
    const next = new URL(path, location.origin).href;
    return this.reconstructDOM({ type: 'go', next, prev });
  }

  /**
   * Navigate back
   */
  public back(): void {
    window.history.back();
  }

  /**
   * Navigate forward
   */
  public forward(): void {
    window.history.forward();
  }

  /**
   * Find all links on page
   */
  private get allLinks(): (HTMLAnchorElement | HTMLAreaElement)[] {
    return Array.from(document.links).filter(
      (node) =>
        node.href.includes(document.location.origin) && // on origin url
        !node.href.includes('#') && // not an id anchor
        node.href !== (document.location.href || document.location.href + '/') && // not current page
        !this.prefetched.has(node.href), // not already prefetched
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log(...args: any[]): void {
    this.opts?.log && console.log(...args);
  }

  /**
   *  Check if the route is qualified for prefetching and prefetch it with chosen method
   */
  private prefetch(): void {
    if (this.opts?.prefetch === 'visible') {
      this.prefetchVisible();
    } else if (this.opts?.prefetch === 'hover') {
      this.prefetchOnHover();
    } else {
      return;
    }
  }

  /**
   *  Finds links on page and prefetches them on hover
   */
  private prefetchOnHover(): void {
    this.allLinks.forEach((node) => {
      const url = node.getAttribute('href');
      if (url === null) return;
      // Using `pointerenter` instead of `mouseenter` to support touch devices hover behavior, PS: `pointerenter` event fires only once
      node.addEventListener('pointerenter', () => this.createLink(url), { once: true });
    });
  }

  /**
   *  Prefetch all visible links
   */
  private prefetchVisible(): void {
    const intersectionOpts = {
      root: null,
      rootMargin: '0px',
      threshold: 1.0,
    };

    if ('IntersectionObserver' in window) {
      this.observer ||= new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          const url = entry.target.getAttribute('href');
          if (url === null) return;

          if (this.prefetched.has(url)) {
            observer.unobserve(entry.target);
            return;
          }

          if (entry.isIntersecting) {
            this.createLink(url);
            observer.unobserve(entry.target);
          }
        });
      }, intersectionOpts);
      this.allLinks.forEach((node) => this.observer?.observe(node));
    }
  }

  /**
   * @param  {string} url
   * Create a link to prefetch
   */
  private createLink(url: string): void {
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

  /**
   * @param  {MouseEvent} e
   * Handle clicks on links
   */
  private onClick(e: MouseEvent): void {
    this.reconstructDOM(handleLinkClick(e));
  }

  /**
   * @param  {PopStateEvent} e
   * Handle popstate events like back/forward
   */
  private onPop(e: PopStateEvent): void {
    this.reconstructDOM(handlePopState(e));
  }
  /**
   * @param  {RouteChangeData} routeChangeData
   * Main process for reconstructing the DOM
   */
  private async reconstructDOM(routeChangeData: RouteChangeData): Promise<boolean> {
    if (!this.enabled) {
      this.log('router disabled');
      return false;
    }

    try {
      this.log('⚡', routeChangeData.type);

      return await this.reconstructDOMUnsafe(routeChangeData);
    } catch (err) {
      window.dispatchEvent(new CustomEvent('flamethrower:router:error', err instanceof Error ? { detail: err } : undefined));
      this.opts?.log && console.timeEnd('⏱️');
      console.error('💥 router fetch failed', err);
      return false;
    }
  }

  private async reconstructDOMUnsafe(routeChangeData: RouteChangeData): Promise<boolean> {
    // Check type && window href destination
    // Disqualify if fetching same URL
    if (!(routeChangeData.type === 'popstate' || routeChangeData.type === 'link' || routeChangeData.type === 'go')) return false;
    if (routeChangeData.next === routeChangeData.prev) return false;

    const { type, next, scrollId } = routeChangeData;

    this.opts?.log && console.time('⏱️');

    window.dispatchEvent(new CustomEvent('flamethrower:router:fetch'));

    // Update window history
    if (type !== 'popstate') {
      addToPushState(next);
    }

    // Fetch next document
    const res = await fetch(next, { headers: { 'X-Flamethrower': '1' } })
      .then((res) => this.responseToProgressStream(res))
      .then((stream) => new Response(stream, { headers: { 'Content-Type': 'text/html' } }));

    const html = await res.text();
    const nextDoc = formatNextDocument(html);

    // Merge HEAD
    mergeHead(nextDoc);

    // Merge BODY
    // with optional native browser page transitions
    const modernDoc = document as ModernDocument;
    if (this.opts?.pageTransitions && modernDoc.createDocumentTransition) {
      const transition = modernDoc.createDocumentTransition();
      transition.start(() => {
        replaceBody(nextDoc);
        runScripts();
        scrollTo(type, scrollId);
      });
    } else {
      replaceBody(nextDoc);
      runScripts();
      scrollTo(type, scrollId);
    }

    window.dispatchEvent(new CustomEvent('flamethrower:router:end'));

    // delay for any js rendered links
    setTimeout(() => {
      this.prefetch();
    }, 200);

    this.opts?.log && console.timeEnd('⏱️');

    return false;
  }

  private responseToProgressStream(response: Response): ReadableStream {
    if (!response.body) throw new Error('Response has no body');

    const reader = response.body.getReader();
    const lengthString = response.headers.get('Content-Length');
    const length = lengthString !== null ? parseInt('-1') : Infinity;

    let bytesReceived = 0;

    // take each received chunk and emit an event, pass through to new stream which will be read as text
    return new ReadableStream({
      start(controller) {
        // The following function handles each data chunk
        function push(): void {
          // "done" is a Boolean and value a "Uint8Array"
          reader.read().then(({ done, value }) => {
            // If there is no more data to read
            if (done) {
              controller.close();
              return;
            }

            bytesReceived += value.length;
            window.dispatchEvent(
              new CustomEvent<FetchProgressEvent>('flamethrower:router:fetch-progress', {
                detail: {
                  // length may be NaN if no Content-Length header was found
                  progress: (bytesReceived / length) * 100,
                  received: bytesReceived,
                  length: length || 0,
                },
              }),
            );
            // Get the data and send it to the browser via the controller
            controller.enqueue(value);
            // Check chunks by logging to the console
            push();
          });
        }

        push();
      },
    });
  }
}
