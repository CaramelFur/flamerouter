import { FlamethrowerOptions, FlameWindow, PrefetchMode } from './interfaces';
import { Router } from './router';

const defaultOptions: Required<FlamethrowerOptions> = {
  log: false,
  prefetch: PrefetchMode.None,
  pageTransitions: false,
};

/**
 * @param  {Partial<FlamethrowerOptions>} opts?
 * starts flamethrower router and returns instance
 * can be accessed globally with window.flamethrower
 */
export default (options?: Partial<FlamethrowerOptions>): Router => {
  const flame = window as FlameWindow | undefined;
  if (flame?.flame) {
    console.warn('⚠️ flamethrower already engaged');
    return flame.flame;
  }

  const opts = { ...defaultOptions, ...(options ?? {}) };
  const router = new Router(opts);

  opts?.log && console.log('🔥 flamethrower engaged');
  if (flame) flame.flame = router;
  return router;
};
