import { describe, it, expect } from 'vitest';
import { memStore } from './helpers.js';
import { ConfigService } from '../config-service.js';

describe('ConfigService precedence + masking', () => {
  it('uses defaults when neither env nor db set', async () => {
    const store = await memStore();
    const svc = new ConfigService(store, {});
    const eff = await svc.getEffective();
    expect(eff.vision_provider).toBe('openai');
    expect(eff.vision_base_url).toBe('https://api.openai.com/v1');
    expect(eff.vision_model).toBe('gpt-4o-mini');
    expect(eff.immich_album).toBe('Food');
    expect(eff.poll_interval_minutes).toBe(90);
    expect(await svc.isConfigured()).toBe(false);
  });

  it('db values fill in when env is absent', async () => {
    const store = await memStore();
    const svc = new ConfigService(store, {});
    await svc.update({
      immich_url: 'https://immich.example.com',
      immich_api_key: 'db-immich-key',
      vision_api_key: 'db-vision-key',
      vision_model: 'gpt-4o',
    });
    const eff = await svc.getEffective();
    expect(eff.immich_url).toBe('https://immich.example.com');
    expect(eff.vision_model).toBe('gpt-4o');
    expect(await svc.isConfigured()).toBe(true);
  });

  it('env wins over db and locks the field', async () => {
    const store = await memStore();
    await store.setAppConfig({ immich_url: 'https://db-host' });
    const svc = new ConfigService(store, { IMMICH_URL: 'https://env-host' });
    const eff = await svc.getEffective();
    expect(eff.immich_url).toBe('https://env-host');
    expect(svc.isLocked('immich_url')).toBe(true);
    expect(svc.isLocked('vision_model')).toBe(false);
  });

  it('PUT does not overwrite env-locked fields', async () => {
    const store = await memStore();
    const svc = new ConfigService(store, { VISION_API_KEY: 'env-key' });
    await svc.update({ vision_api_key: 'attempted-override', vision_model: 'm' });
    const eff = await svc.getEffective();
    expect(eff.vision_api_key).toBe('env-key'); // unchanged
    expect(eff.vision_model).toBe('m'); // non-locked saved
    // db should not have stored the locked field
    const db = await store.getAppConfig();
    expect(db.vision_api_key).toBeUndefined();
  });

  it('masks secrets: never returns plaintext value, only set/locked', async () => {
    const store = await memStore();
    const svc = new ConfigService(store, { IMMICH_API_KEY: 'super-secret' });
    await svc.update({ vision_api_key: 'db-secret', immich_url: 'https://x' });
    const view = await svc.getView();
    // immich_api_key set via env → set+locked, NO value field
    expect(view.fields.immich_api_key.set).toBe(true);
    expect(view.fields.immich_api_key.locked).toBe(true);
    expect(view.fields.immich_api_key).not.toHaveProperty('value');
    // vision_api_key set via db → set, not locked, still NO value
    expect(view.fields.vision_api_key.set).toBe(true);
    expect(view.fields.vision_api_key.locked).toBe(false);
    expect(view.fields.vision_api_key).not.toHaveProperty('value');
    // non-secret value is returned
    expect(view.fields.immich_url.value).toBe('https://x');
    expect(view.fields.immich_url.locked).toBe(false);
  });

  it('reports set=false for unset non-secret fields but shows default value', async () => {
    const store = await memStore();
    const svc = new ConfigService(store, {});
    const view = await svc.getView();
    expect(view.fields.immich_url.set).toBe(false);
    // default value surfaced for convenience
    expect(view.fields.vision_base_url.value).toBe('https://api.openai.com/v1');
    expect(view.configured).toBe(false);
  });

  it('coerces poll_interval_minutes to a number in the view and effective config', async () => {
    const store = await memStore();
    const svc = new ConfigService(store, {});
    await svc.update({ poll_interval_minutes: '15' });
    const view = await svc.getView();
    expect(view.fields.poll_interval_minutes.value).toBe(15);
    expect((await svc.getEffective()).poll_interval_minutes).toBe(15);
  });
});
