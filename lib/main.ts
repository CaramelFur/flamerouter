import { FlamethrowerOptions, FlameWindow } from './interfaces';
import { Router } from './router';

/**
 * @param  {FlamethrowerOptions} opts?
 * starts flamethrower router and returns instance
 * can be accessed globally with window.flamethrower
 */
export default (opts?: FlamethrowerOptions): Router => {
  const flame = window as FlameWindow | undefined;
  if (flame?.flamethrower) return flame.flamethrower;

  const router = new Router(opts);
  opts?.log && console.log('🔥 flamethrower engaged');
  if (flame) flame.flamethrower = router;
  return router;
};
