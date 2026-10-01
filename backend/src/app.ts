import { Hono, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';

import { balancesRoutes } from './routes/balances.js';
import type { BalanceSummaryDeps } from './services/balance-summary.js';

export type AppDeps = BalanceSummaryDeps & {
  /** Matikan log request (mis. saat tes). */
  logRequests?: boolean;
};

/** Log singkat tanpa query string, supaya alamat wallet tidak ikut tercatat. */
const requestLogger: MiddlewareHandler = async (c, next) => {
  const startedAt = performance.now();
  await next();
  const ms = Math.round(performance.now() - startedAt);
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
};

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  if (deps.logRequests !== false) app.use('*', requestLogger);
  app.use('/v1/*', cors({ origin: '*', allowMethods: ['GET'] }));

  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/v1/balances', balancesRoutes(deps));

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((error, c) => {
    console.error(`[error] ${c.req.method} ${c.req.path}: ${error.name}`);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}
