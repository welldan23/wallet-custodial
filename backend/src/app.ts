import { Hono, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';

import { addressCheckRoutes } from './routes/address-check.js';
import { balancesRoutes } from './routes/balances.js';
import { contactsRoutes, type ContactsRouteDeps } from './routes/contacts.js';
import { feesRoutes, type FeesRouteDeps } from './routes/fees.js';
import { networksRoutes } from './routes/networks.js';
import { transactionsRoutes, type TransactionsRouteDeps } from './routes/transactions.js';
import { pricesRoutes, type PricesRouteDeps } from './routes/prices.js';
import { swapRoutes, type SwapRouteDeps } from './routes/swap.js';
import type { BalanceSummaryDeps } from './services/balance-summary.js';

export type AppDeps = BalanceSummaryDeps &
  PricesRouteDeps &
  Omit<FeesRouteDeps, 'feeEstimators'> & {
    /** Penghitung biaya per jaringan; kosong = endpoint biaya menjawab 503. */
    feeEstimators?: FeesRouteDeps['feeEstimators'];
    /** Penyedia quote swap (LI.FI/Jupiter); tanpa ini /v1/swap/quote menjawab 503. */
    swapQuotes?: SwapRouteDeps['swapQuotes'];
    /** Tanpa ini, /v1/contacts tidak dipasang. */
    contactStore?: ContactsRouteDeps['contactStore'];
    /** Tanpa ini, POST /v1/transactions dan /v1/address-check tidak dipasang. */
    transactions?: Omit<TransactionsRouteDeps, 'loadCatalog' | 'rpcTimeoutMs'>;
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
  // Endpoint transaksi menerima POST; sisanya data baca-saja (GET).
  app.use('/v1/transactions', cors({ origin: '*', allowMethods: ['GET', 'POST'] }));
  app.use('/v1/transactions/*', cors({ origin: '*', allowMethods: ['GET', 'POST'] }));
  // Kontak memakai header Authorization (token perangkat).
  app.use(
    '/v1/contacts',
    cors({ origin: '*', allowMethods: ['GET'], allowHeaders: ['Authorization', 'Content-Type'] }),
  );
  app.use('/v1/*', cors({ origin: '*', allowMethods: ['GET'] }));

  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/v1/networks', networksRoutes(deps));
  app.route('/v1/fees', feesRoutes({ ...deps, feeEstimators: deps.feeEstimators ?? new Map() }));
  app.route('/v1/balances', balancesRoutes(deps));
  if (deps.contactStore) {
    app.route('/v1/contacts', contactsRoutes({ ...deps, contactStore: deps.contactStore }));
  }
  if (deps.transactions) {
    app.route('/v1/transactions', transactionsRoutes({ ...deps, ...deps.transactions }));
    app.route('/v1/address-check', addressCheckRoutes({ ...deps, ...deps.transactions }));
  }
  app.route('/v1/prices', pricesRoutes(deps));
  app.route('/v1/swap', swapRoutes(deps));

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((error, c) => {
    console.error(`[error] ${c.req.method} ${c.req.path}: ${error.name}`);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}
