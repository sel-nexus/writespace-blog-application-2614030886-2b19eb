/** Verify actual browser session reads, exact writes, and non-destructive failure behavior. */
import { describe, expect, it, vi } from 'vitest';
import { clearSession, getSession, setSession } from '../src/utils/auth';

const session = { userId: 'u1', username: 'mina', displayName: 'Mina', role: 'user' };

 describe('getSession', () => {
  it('returns null when absent without writing or clearing', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    expect(getSession()).toBeNull();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it.each(['broken', 'null', '[]', '1', '"text"', 'true', '{}',
    JSON.stringify({ ...session, role: 'owner' })])('leaves invalid raw %s untouched', raw => {
    localStorage.setItem('writespace_session', raw);
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('writespace_session')).toBe(raw);
  });
  it.each(['userId', 'username', 'displayName'])('rejects missing, invalid and blank %s', field => {
    for (const value of [undefined, null, 2, false, [], {}, '', ' \t\n ']) {
      localStorage.setItem('writespace_session', JSON.stringify({ ...session, [field]: value }));
      const raw = localStorage.getItem('writespace_session');
      expect(getSession()).toBeNull();
      expect(localStorage.getItem('writespace_session')).toBe(raw);
    }
  });
  it.each(['user', 'admin'])('reads %s and strips extra fields without repair', role => {
    const raw = JSON.stringify({ ...session, role, password: 'not-for-session' });
    localStorage.setItem('writespace_session', raw);
    expect(getSession()).toEqual({ ...session, role });
    expect(localStorage.getItem('writespace_session')).toBe(raw);
  });
  it('returns null when storage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    expect(getSession()).toBeNull();
  });
  it('returns null when the storage global is inaccessible', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getSession()).toBeNull();
  });
});

describe('setSession', () => {
  it.each(['user', 'admin'])('writes exactly the %s session and rereads it', role => {
    expect(setSession({ ...session, role, password: 'demo', extra: 1 })).toBe(true);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual({ ...session, role });
    expect(getSession()).toEqual({ ...session, role });
  });
  it.each([undefined, null, [], false, 2, 'session', {}, { ...session, role: 'owner' }])(
    'rejects invalid candidate %j preserving prior session', value => {
      setSession(session);
      expect(setSession(value)).toBe(false);
      expect(getSession()).toEqual(session);
    },
  );
  it.each(['userId', 'username', 'displayName'])('rejects unusable %s before storage', field => {
    for (const value of [undefined, null, 1, false, [], {}, '', '  ']) {
      expect(setSession({ ...session, [field]: value })).toBe(false);
      expect(localStorage.getItem('writespace_session')).toBeNull();
    }
  });
  it('catches validation getter exceptions', () => {
    expect(setSession({ get userId() { throw new Error('Getter'); } })).toBe(false);
    expect(localStorage.getItem('writespace_session')).toBeNull();
  });
  it('catches serialization failure preserving the existing raw session', () => {
    setSession(session);
    vi.spyOn(JSON, 'stringify').mockImplementation(() => { throw new Error('Serialization'); });
    expect(setSession({ ...session, username: 'other' })).toBe(false);
    expect(getSession()).toEqual(session);
  });
  it('catches quota failure preserving the existing identity', () => {
    setSession(session);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota', 'QuotaExceededError'); });
    expect(setSession({ ...session, username: 'other' })).toBe(false);
    expect(getSession()).toEqual(session);
  });
  it('catches unavailable storage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(setSession(session)).toBe(false);
  });
});

describe('clearSession', () => {
  it('removes only session and is idempotent', () => {
    localStorage.setItem('writespace_users', '[{"id":"u1"}]');
    localStorage.setItem('writespace_posts', '[{"id":"p1"}]');
    localStorage.setItem('unrelated', 'keep');
    setSession(session);
    expect(clearSession()).toBe(true);
    expect(getSession()).toBeNull();
    expect(localStorage.getItem('writespace_users')).toBe('[{"id":"u1"}]');
    expect(localStorage.getItem('writespace_posts')).toBe('[{"id":"p1"}]');
    expect(localStorage.getItem('unrelated')).toBe('keep');
    expect(clearSession()).toBe(true);
  });
  it('reports failed removal and retains identity', () => {
    setSession(session);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Denied'); });
    expect(clearSession()).toBe(false);
    expect(getSession()).toEqual(session);
  });
  it('reports inaccessible storage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(clearSession()).toBe(false);
  });
});
