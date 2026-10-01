import { Hono } from 'hono';

import type { Catalog } from '../catalog/repository.js';
import { DEVICE_TOKEN_PATTERN, type ContactStore } from '../contacts/store.js';

export type ContactsRouteDeps = {
  loadCatalog: () => Catalog;
  contactStore: ContactStore;
};

/** Ambil token dari header `Authorization: Device <token>`; `null` kalau tidak valid. */
export function deviceTokenFrom(header: string | undefined): string | null {
  const match = /^Device\s+(\S+)$/i.exec(header?.trim() ?? '');
  const token = match?.[1];
  return token && DEVICE_TOKEN_PATTERN.test(token) ? token : null;
}

/**
 * GET /v1/contacts[?network=arbitrum] — Buku Alamat milik perangkat ini.
 *
 * Wajib header `Authorization: Device <token acak dari HP>`; kontak tidak
 * bisa dibaca hanya dengan alamat wallet (alamat itu publik). Dengan
 * `network`, hanya kontak yang bisa dipakai di jaringan itu.
 */
export function contactsRoutes(deps: ContactsRouteDeps): Hono {
  const app = new Hono();

  app.get('/', (c) => {
    c.header('Cache-Control', 'no-store');
    const token = deviceTokenFrom(c.req.header('Authorization'));
    if (!token) {
      return c.json({ error: 'unauthorized', message: 'Send Authorization: Device <token>.' }, 401);
    }

    const networkId = c.req.query('network')?.trim();
    let usableOn: { networkId: string; chainType: 'evm' | 'solana' } | undefined;
    if (networkId) {
      const network = deps
        .loadCatalog()
        .networks.find((item) => item.id === networkId && item.isActive);
      if (!network) {
        return c.json({ error: 'unknown_network', message: 'network is not supported.' }, 400);
      }
      usableOn = { networkId: network.id, chainType: network.chainType };
    }

    // Perangkat yang belum pernah menyimpan kontak = daftar kosong (tidak dibuat akun).
    const userId = deps.contactStore.findUserId(token);
    return c.json({ contacts: userId ? deps.contactStore.list(userId, usableOn) : [] });
  });

  return app;
}
