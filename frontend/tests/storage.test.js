/** Verify defensive array contracts and truthful browser write results. */
import { describe, expect, it, vi } from 'vitest';
import { getPosts, getUsers, savePosts, saveUsers } from '../src/utils/storage';

const stores = [
  ['posts', 'writespace_posts', getPosts, savePosts],
  ['users', 'writespace_users', getUsers, saveUsers],
];

describe.each(stores)('%s storage', (_name, key, read, save) => {
  it('returns a fresh empty fallback without creating missing keys', () => {
    expect(read()).toEqual([]);
    expect(read()).not.toBe(read());
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('round trips an array on its exact key and preserves other records', () => {
    localStorage.setItem('writespace_session', '{"role":"user"}');
    const rows = [{ id: 'demo', content: 'text', nested: { value: 1 } }];
    expect(save(rows)).toBe(true);
    expect(read()).toEqual(rows);
    expect(read()).not.toBe(rows);
    expect(localStorage.getItem(key)).toBe(JSON.stringify(rows));
    expect(localStorage.getItem('writespace_session')).toBe('{"role":"user"}');
    expect(localStorage.getItem(key === 'writespace_posts' ? 'writespace_users' : 'writespace_posts')).toBeNull();
  });

  it.each(['{broken', '', 'null', '{}', '42', '"array"', 'true'])(
    'preserves unusable raw data %j while returning an empty fallback', raw => {
      localStorage.setItem(key, raw);
      const setter = vi.spyOn(Storage.prototype, 'setItem');
      expect(read()).toEqual([]);
      expect(localStorage.getItem(key)).toBe(raw);
      expect(setter).not.toHaveBeenCalled();
    },
  );

  it('passes array members through for projection validation without repair', () => {
    localStorage.setItem(key, '[null,42,{},"text"]');
    expect(read()).toEqual([null, 42, {}, 'text']);
    expect(localStorage.getItem(key)).toBe('[null,42,{},"text"]');
  });

  it('catches getItem failures', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Unavailable', 'SecurityError');
    });
    expect(read()).toEqual([]);
  });

  it('catches localStorage property getter failures for reads and writes', () => {
    const getter = vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(read()).toEqual([]);
    expect(save([])).toBe(false);
    getter.mockRestore();
  });

  it.each(['QuotaExceededError', 'SecurityError'])('reports a %s setter failure', name => {
    localStorage.setItem(key, '[{"id":"original"}]');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Write rejected', name);
    });
    expect(save([{ id: 'replacement' }])).toBe(false);
    expect(read()).toEqual([{ id: 'original' }]);
  });

  it.each([null, undefined, {}, '[]', 12, true])('rejects non-array input %j without writing', value => {
    localStorage.setItem(key, '[1]');
    const setter = vi.spyOn(Storage.prototype, 'setItem');
    expect(save(value)).toBe(false);
    expect(setter).not.toHaveBeenCalled();
    expect(read()).toEqual([1]);
  });

  it('catches circular, bigint and throwing serialization without writing', () => {
    const circular = [];
    circular.push(circular);
    const throwing = [{ toJSON() { throw new Error('Cannot serialize'); } }];
    const setter = vi.spyOn(Storage.prototype, 'setItem');
    for (const value of [circular, [1n], throwing]) {
      expect(save(value)).toBe(false);
    }
    expect(setter).not.toHaveBeenCalled();
  });

  it('rejects array serializers that return undefined or a non-array', () => {
    const setter = vi.spyOn(Storage.prototype, 'setItem');
    for (const serialized of [undefined, null, {}, 'wrong']) {
      const value = [];
      value.toJSON = () => serialized;
      expect(save(value)).toBe(false);
    }
    expect(setter).not.toHaveBeenCalled();
  });
});
