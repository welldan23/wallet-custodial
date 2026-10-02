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

const notFound = (c: Context) =>
  c.json({ error: 'contact_not_found', message: 'Contact does not exist.' }, 404);

const limitBody = bodyLimit({
  maxSize: 4 * 1024,
  onError: (c) => c.json({ error: 'body_too_large', message: 'Request body is too large.' }, 413),
});

/** Body JSON berupa objek, atau `null` kalau bukan. */
async function readObject(c: Context): Promise<Record<string, unknown> | null> {
  const body: unknown = await c.req.json().catch(() => undefined);
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

function storeErrorResponse(c: Context, error: unknown) {
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
      { error: 'contact_limit', message: `At most ${MAX_CONTACTS_PER_USER} contacts per device.` },
      409,
    );
  }
  throw error;
}

const invalidJson = (c: Context) =>
  c.json({ error: 'invalid_json', message: 'Body must be a JSON object.' }, 400);

const EDITABLE_FIELDS = ['name', 'address', 'networkId', 'isFavorite'] as const;

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
  app.post('/', limitBody, async (c) => {
    c.header('Cache-Control', 'no-store');
    const token = deviceTokenFrom(c.req.header('Authorization'));
    if (!token) return unauthorized(c);

    const body = await readObject(c);
    if (!body) return invalidJson(c);
    const parsed = parseContactInput(body, deps.loadCatalog());
    if (!parsed.ok) {
      const { ok: _ok, ...error } = parsed;
      return c.json({ ...error, message: INPUT_MESSAGES[error.error] }, 400);
    }

    const userId = deps.contactStore.ensureUserId(token);
    try {
      return c.json({ contact: deps.contactStore.add(userId, parsed.contact) }, 201);
    } catch (error) {
      return storeErrorResponse(c, error);
    }
  });

  /**
   * PATCH /v1/contacts/:id — ubah sebagian atau semua isi kontak
   * (`name`, `address`, `networkId`, `isFavorite`). Hasil gabungannya dicek
   * dengan aturan yang sama seperti saat menambah. Kontak perangkat lain
   * dianggap tidak ada (404).
   */
  app.patch('/:id', limitBody, async (c) => {
    c.header('Cache-Control', 'no-store');
    const token = deviceTokenFrom(c.req.header('Authorization'));
    if (!token) return unauthorized(c);
    const userId = deps.contactStore.findUserId(token);
    const existing = userId ? deps.contactStore.get(userId, c.req.param('id')) : null;
    if (!userId || !existing) return notFound(c);

    const body = await readObject(c);
    if (!body) return invalidJson(c);
    if (!EDITABLE_FIELDS.some((field) => field in body)) {
      return c.json(
        { error: 'empty_update', message: `Send at least one of: ${EDITABLE_FIELDS.join(', ')}.` },
        400,
      );
    }
    const merged = {
      name: 'name' in body ? body.name : existing.name,
      address: 'address' in body ? body.address : existing.address,
      networkId: 'networkId' in body ? body.networkId : existing.networkId,
      isFavorite: 'isFavorite' in body ? body.isFavorite : existing.isFavorite,
    };
    const parsed = parseContactInput(merged, deps.loadCatalog());
    if (!parsed.ok) {
      const { ok: _ok, ...error } = parsed;
      return c.json({ ...error, message: INPUT_MESSAGES[error.error] }, 400);
    }

    try {
      const contact = deps.contactStore.update(userId, existing.id, parsed.contact);
      return contact ? c.json({ contact }) : notFound(c);
    } catch (error) {
      return storeErrorResponse(c, error);
    }
  });

  /** DELETE /v1/contacts/:id — hapus kontak. 204 kalau berhasil. */
  app.delete('/:id', (c) => {
    c.header('Cache-Control', 'no-store');
    const token = deviceTokenFrom(c.req.header('Authorization'));
    if (!token) return unauthorized(c);
    const userId = deps.contactStore.findUserId(token);
    if (!userId || !deps.contactStore.remove(userId, c.req.param('id'))) return notFound(c);
    return c.body(null, 204);
  });

  return app;
}
