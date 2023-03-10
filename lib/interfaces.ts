import { Router } from './router';

export enum PrefetchMode {
  Visible = 'visible',
  Hover = 'hover',
  None = 'none',
}

export interface FlamethrowerOptions {
  log: boolean;
  /**
   * prefetch method can be either 'visible' or 'hover'
   * visible: prefetches all links that are currently visible on the page
   * hover: prefetches all links that are hovered over
   * undefined: no prefetching
   * @default undefined
   */
  prefetch: PrefetchMode;
  pageTransitions: boolean;
}

export enum TransitionType {
  Link = 'link',
  Popstate = 'pop',
  Scroll = 'scroll',
  Noop = 'noop',
}

export type RouteChangeData =
  | {
      type: TransitionType.Noop;
    }
  | {
      type: TransitionType.Scroll;
      scrollId: string;
    }
  | {
      type: TransitionType.Link | TransitionType.Popstate;
      next: string;
      scrollId: string | null;
      prev?: string;
    };

export type FlameWindow = Window & typeof globalThis & { flame: Router };

export type FetchProgressEvent = {
  /** Percentage of bytes that have been sent as a percentage e.g. 100% -> 100, 50% -> 50 */
  progress: number;
  /** Number of bytes that have been received */
  received: number;
  /** Number of bytes total (Content-Length header) */
  length: number;
};
