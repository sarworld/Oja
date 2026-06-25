import { describe, it, expect, vi, afterEach } from 'vitest';
import { ImmichClient } from '../immich.js';

function jsonRes(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('ImmichClient album assets (Immich v2 + v3 compatible)', () => {
  afterEach(() => vi.restoreAllMocks());

  // Immich v3 removed the embedded `assets` array from GET /api/albums/:id, so
  // assets must be fetched via the metadata search API (works on v2 and v3).
  it('lists assets via /api/search/metadata and follows pagination', async () => {
    const fetchMock = vi
      .fn()
      // resolveAlbumId -> GET /api/albums
      .mockResolvedValueOnce(jsonRes([{ id: 'alb1', albumName: 'Food', assetCount: 3 }]))
      // search page 1
      .mockResolvedValueOnce(jsonRes({ assets: { items: [{ id: 'a1' }, { id: 'a2' }], nextPage: '2' } }))
      // search page 2
      .mockResolvedValueOnce(jsonRes({ assets: { items: [{ id: 'a3' }], nextPage: null } }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new ImmichClient({ url: 'http://immich', api_key: 'k', album: 'Food' });
    const assets = await client.listAlbumAssets();

    expect(assets.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes('/api/search/metadata')).length).toBe(2);
    // must NOT rely on the v2-only album-detail assets array
    expect(urls.some((u) => /\/api\/albums\/alb1$/.test(u))).toBe(false);
  });
});
