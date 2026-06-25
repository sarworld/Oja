export interface ImmichAsset {
  id: string;
  fileCreatedAt?: string;
  localDateTime?: string;
  type?: string;
  originalFileName?: string;
}

export type ThumbnailSize = 'thumbnail' | 'preview';

export interface ImmichConfig {
  url: string;
  api_key: string;
  album: string;
}

export interface AlbumSummary {
  id: string;
  name: string;
  assetCount: number;
}

/**
 * Thin Immich API client. Built per-call from the *effective* config so UI
 * changes take effect without a restart. The API key stays server-side; it is
 * never sent to the browser. Photo bytes are proxied through `/api/photo/:id`.
 */
export class ImmichClient {
  private base: string;
  private key: string;
  private albumRef: string;

  constructor(cfg: ImmichConfig) {
    this.base = (cfg.url || '').replace(/\/+$/, '');
    this.key = cfg.api_key || '';
    this.albumRef = cfg.album || '';
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      'x-api-key': this.key,
      Accept: 'application/json',
      ...extra,
    };
  }

  private looksLikeUuid(s: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  }

  /** List every album (for the setup picker / connection test). */
  async listAlbums(): Promise<AlbumSummary[]> {
    const res = await fetch(`${this.base}/api/albums`, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(`Immich: failed to list albums (${res.status})`);
    }
    const albums = (await res.json()) as Array<{
      id: string;
      albumName: string;
      assetCount?: number;
    }>;
    return albums.map((a) => ({
      id: a.id,
      name: a.albumName,
      assetCount: a.assetCount ?? 0,
    }));
  }

  /** Resolve the configured album (by id or by name) to its id. */
  async resolveAlbumId(): Promise<string> {
    const ref = this.albumRef.trim();
    if (!ref) throw new Error('Immich: no album configured');
    if (this.looksLikeUuid(ref)) return ref;

    const albums = await this.listAlbums();
    const match = albums.find((a) => a.name?.toLowerCase() === ref.toLowerCase());
    if (!match) {
      throw new Error(
        `Immich: album "${ref}" not found. Create it or set the album to its id.`,
      );
    }
    return match.id;
  }

  /**
   * List all image assets in the configured album.
   *
   * Uses the metadata search API rather than `GET /api/albums/:id` because
   * Immich v3 dropped the embedded `assets` array from the album detail
   * response. `POST /api/search/metadata` works on both v2 and v3 and paginates.
   */
  async listAlbumAssets(): Promise<ImmichAsset[]> {
    const albumId = await this.resolveAlbumId();
    const out: ImmichAsset[] = [];
    let page: number | null = 1;
    while (page != null) {
      const res = await fetch(`${this.base}/api/search/metadata`, {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ albumIds: [albumId], type: 'IMAGE', page, size: 1000 }),
      });
      if (!res.ok) {
        throw new Error(`Immich: failed to list album assets (${res.status})`);
      }
      const body = (await res.json()) as {
        assets?: { items?: ImmichAsset[]; nextPage?: string | number | null };
      };
      out.push(...(body.assets?.items ?? []));
      const next = body.assets?.nextPage;
      page = next != null ? Number(next) : null;
    }
    return out;
  }

  /** Fetch raw image bytes for an asset at the requested size. */
  async getThumbnailBytes(
    assetId: string,
    size: ThumbnailSize = 'thumbnail',
  ): Promise<{ bytes: Buffer; contentType: string }> {
    const res = await fetch(
      `${this.base}/api/assets/${assetId}/thumbnail?size=${size}`,
      { headers: this.headers({ Accept: 'image/*' }) },
    );
    if (!res.ok) {
      throw new Error(`Immich: thumbnail fetch failed for ${assetId} (${res.status})`);
    }
    // Cap the proxied response so a misconfigured/hostile source can't exhaust
    // memory (thumbnails are tiny; 25 MB is a generous ceiling).
    const MAX_BYTES = 25 * 1024 * 1024;
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES) {
      throw new Error(`Immich: thumbnail too large (${declared} bytes)`);
    }
    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > MAX_BYTES) {
      throw new Error('Immich: thumbnail exceeds size limit');
    }
    return {
      bytes: Buffer.from(arrayBuf),
      contentType: res.headers.get('content-type') ?? 'image/jpeg',
    };
  }

  /** A data: URL the vision model can read (uses the preview for better detail). */
  async getDataUrl(assetId: string, size: ThumbnailSize = 'preview'): Promise<string> {
    const { bytes, contentType } = await this.getThumbnailBytes(assetId, size);
    return `data:${contentType};base64,${bytes.toString('base64')}`;
  }
}
