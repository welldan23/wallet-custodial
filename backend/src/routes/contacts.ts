import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import type { Catalog } from '../catalog/repository.js';
import {
  ContactLimitError,
  DEVICE_TOKEN_PATTERN,
  DuplicateContactError,
  MAX_CONTACTS_PER_USER,
  type ContactStore,
} from '../contacts/store.js';
import { parseContactInput, type ContactInputError } from '../contacts/validate.js';

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

const INPUT_MESSAGES: Record<ContactInputError['error'], string> = {
  invalid_name: 'name must be 1-40 characters.',
  invalid_address: 'address is not valid for this network.',
  unknown_network: 'networkId is not supported.',
  invalid_favorite: 'isFavorite must be a boolean.',
};

const unauthorized = (c: Context) =>
  c.json({ error: 'unauthorized', message: 'Send Authorization: Device <token>.' }, 401);

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
    if (!token) return unauthorized(c);

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

  /**
   * POST /v1/contacts — simpan kontak baru.
   * Body `{ name, address, networkId?, isFavorite? }`; aturannya sama dengan
   * form di aplikasi. Alamat EVM disimpan dalam format checksum.
   */
  app.post(
    '/',
    bodyLimit({
      maxSize: 4 * 1024,
      onError: (c) =>
        c.json({ error: 'body_too_large', message: 'Request body is too large.' }, 413),
    }),
    async (c) => {
      c.header('Cache-Control', 'no-store');
      const token = deviceTokenFrom(c.req.header('Authorization'));
      if (!token) return unauthorized(c);

      const body = await c.req.json().catch(() => undefined);
      if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
        return c.json({ error: 'invalid_json', message: 'Body must be a JSON object.' }, 400);
      }
      const parsed = parseContactInput(body, deps.loadCatalog().networks);
      if (!parsed.ok) {
        const { ok: _ok, ...error } = parsed;
        return c.json({ ...error, message: INPUT_MESSAGES[error.error] }, 400);
      }

      const userId = deps.contactStore.ensureUserId(token);
      try {
        const contact = deps.contactStore.add(userId, parsed.contact);
        return c.json({ contact }, 201);
      } catch (error) {
        if (error instanceof DuplicateContactError) {
          return c.json(
            {
              error: 'duplicate_contact',
              message: 'This address is already saved for an overlapping network.',
              existing: error.existing,
            },
            409,
          );
        }
        if (error instanceof ContactLimitError) {
          return c.json(
            {
              error: 'contact_limit',
              message: `At most ${MAX_CONTACTS_PER_USER} contacts per device.`,
            },
            409,
          );
        }
        throw error;
      }
    },
  );

  return app;
}
