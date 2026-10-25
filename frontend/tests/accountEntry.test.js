/** Exercise account workflows with real browser storage and controlled capability failures. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ADMIN, login, registerUser } from '../src/utils/accountEntry';
import { getSession, setSession } from '../src/utils/auth';
import { getUsers, saveUsers } from '../src/utils/storage';

const id = '8fc787c4-78da-4f5e-9d74-93e9274892e8';
const input = { displayName: 'Mina', username: 'mina', password: 'demo-only', confirmPassword: 'demo-only' };
const previous = { userId: 'old', username: 'old', displayName: 'Old', role: 'user' };
const user = { id, displayName: 'Mina', username: 'mina', password: 'demo-only', role: 'user', createdAt: '2026-01-15T12:00:00.000Z' };
beforeEach(() => { vi.spyOn(crypto, 'randomUUID').mockReturnValue(id); });

describe('registerUser', () => {
  it.each(Object.keys(input))('rejects each required %s type, missing value and whitespace without writes', field => {
    for (const value of [undefined, null, false, 0, [], {}, '', ' \t\n ']) {
      setSession(previous);
      saveUsers([user]);
      const before = localStorage.getItem('writespace_users');
      const result = registerUser({ ...input, username: 'new', [field]: value });
      expect(result).toMatchObject({ ok: false, error: { code: 'REQUIRED_FIELD', field }, accountWritten: false, sessionWritten: false });
      expect(result.fields[field]).toMatch(/required/);
      expect(result.navigateTo).toBeNull();
      expect(localStorage.getItem('writespace_users')).toBe(before);
      expect(getSession()).toEqual(previous);
    }
  });
  it.each([undefined, null, false, 0, '', []])('collects all required errors for malformed input %j', value => {
    const result = registerUser(value);
    expect(Object.keys(result.fields)).toEqual(Object.keys(input));
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
  it('rejects mismatched passwords before any write', () => {
    const result = registerUser({ ...input, confirmPassword: 'different' });
    expect(result.error).toEqual({ code: 'PASSWORD_MISMATCH', field: 'confirmPassword', message: 'Passwords do not match.' });
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
  it('rejects lowercase reserved admin without saving an ordinary Admin', () => {
    expect(registerUser({ ...input, username: 'admin' }).error.code).toBe('RESERVED_USERNAME');
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
  it('rejects duplicate username anywhere in stored rows including incomplete rows', () => {
    saveUsers([null, { username: 'other' }, user, { username: 'incomplete' }]);
    const before = localStorage.getItem('writespace_users');
    for (const username of ['mina', 'incomplete']) {
      expect(registerUser({ ...input, username }).error).toMatchObject({ code: 'USERNAME_TAKEN', field: 'username' });
      expect(localStorage.getItem('writespace_users')).toBe(before);
      expect(getSession()).toBeNull();
    }
  });
  it('preserves case-sensitive usernames and does not reserve uppercase Admin', () => {
    saveUsers([user]);
    expect(registerUser({ ...input, username: 'Mina' }).ok).toBe(true);
    expect(registerUser({ ...input, username: 'Admin' }).ok).toBe(true);
    expect(getUsers().map(row => row.username)).toEqual(['mina', 'Mina', 'Admin']);
    expect(getSession()).toMatchObject({ username: 'Admin', role: 'user' });
  });
  it('creates a complete UUID/ISO regular user, preserves text, appends, then rereads exact session', () => {
    saveUsers([user]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T05:06:07.000Z'));
    try {
      const result = registerUser({ ...input, username: ' new ', displayName: ' New ', password: ' Demo ', confirmPassword: ' Demo ', role: 'admin' });
      const expected = { userId: id, username: ' new ', displayName: ' New ', role: 'user' };
      expect(result).toEqual({ ok: true, value: expected, navigateTo: '/blogs', accountWritten: true, sessionWritten: true });
      expect(getUsers()).toEqual([user, {
        id, displayName: ' New ', username: ' new ', password: ' Demo ', role: 'user', createdAt: '2026-03-04T05:06:07.000Z',
      }]);
      expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(expected);
      expect(getSession()).toEqual(expected);
    } finally { vi.useRealTimers(); }
  });
  it('uses browser-generated UUIDs without a fallback', () => {
    vi.restoreAllMocks();
    expect(registerUser(input).ok).toBe(true);
    expect(getUsers()[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
  it.each(['missing crypto', 'missing function', 'throwing function', 'empty UUID', 'invalid UUID type'])(
    'reports %s without changing stored users/session', capability => {
      saveUsers([user]);
      setSession(previous);
      if (capability === 'missing crypto') vi.stubGlobal('crypto', undefined);
      if (capability === 'missing function') vi.stubGlobal('crypto', {});
      if (capability === 'throwing function') vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('Unsupported'); });
      if (capability === 'empty UUID') vi.spyOn(crypto, 'randomUUID').mockReturnValue(' ');
      if (capability === 'invalid UUID type') vi.spyOn(crypto, 'randomUUID').mockReturnValue(1);
      expect(registerUser({ ...input, username: 'new' })).toMatchObject({
        ok: false, error: { code: 'UUID_UNAVAILABLE' }, accountWritten: false, sessionWritten: false, navigateTo: null,
      });
      expect(getUsers()).toEqual([user]);
      expect(getSession()).toEqual(previous);
    },
  );
  it('reports account save failure without attempting a session write', () => {
    setSession(previous);
    const keys = [];
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(key => { keys.push(key); throw new Error('Quota'); });
    expect(registerUser(input)).toMatchObject({ ok: false, accountWritten: false, sessionWritten: false, navigateTo: null });
    expect(keys).toEqual(['writespace_users']);
    expect(getUsers()).toEqual([]);
    expect(getSession()).toEqual(previous);
  });
  it('saves users before session and reports partial persistence with explicit later sign-in copy', () => {
    setSession(previous);
    const original = Storage.prototype.setItem;
    const keys = [];
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      keys.push(key);
      if (key === 'writespace_session') throw new Error('Denied');
      original.call(this, key, value);
    });
    const result = registerUser(input);
    expect(keys).toEqual(['writespace_users', 'writespace_session']);
    expect(result).toMatchObject({ ok: false, accountWritten: true, sessionWritten: false, navigateTo: null });
    expect(result.error.message).toMatch(/account may exist.*sign-in did not complete.*Sign in later/);
    expect(getUsers()).toEqual([{ ...user, createdAt: getUsers()[0].createdAt }]);
    expect(getSession()).toEqual(previous);
    vi.restoreAllMocks();
    expect(login('mina', 'demo-only').ok).toBe(true);
    expect(getSession()).toEqual({ userId: id, username: 'mina', displayName: 'Mina', role: 'user' });
  });
  it.each(['bad JSON', '{}', 'null'])('uses defensive array fallback for %s on explicit registration', raw => {
    localStorage.setItem('writespace_users', raw);
    expect(registerUser(input).ok).toBe(true);
    expect(getUsers()).toHaveLength(1);
    expect(getSession()).toMatchObject({ username: 'mina' });
  });
  it('returns write failure when browser storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(registerUser(input)).toMatchObject({ ok: false, error: { code: 'STORAGE_WRITE_FAILED' }, accountWritten: false });
  });
});

describe('login', () => {
  it('gives fixed admin/admin precedence over any colliding stored row and never saves it as a user', () => {
    saveUsers([{ ...user, username: 'admin', password: 'admin', role: 'user' }]);
    const raw = localStorage.getItem('writespace_users');
    expect(login('admin', 'admin')).toMatchObject({ ok: true, value: DEFAULT_ADMIN, navigateTo: '/admin', sessionWritten: true });
    expect(getSession()).toEqual(DEFAULT_ADMIN);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(DEFAULT_ADMIN);
    expect(localStorage.getItem('writespace_users')).toBe(raw);
  });
  it('logs in fixed Admin even if reading users fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    expect(login('admin', 'admin').value).toEqual(DEFAULT_ADMIN);
    vi.restoreAllMocks();
    expect(getSession()).toEqual(DEFAULT_ADMIN);
    expect(getUsers()).toEqual([]);
  });
  it.each(['user', 'admin'])('logs in a stored %s with exact session and destination', role => {
    saveUsers([null, false, 'bad', {}, { ...user, role }]);
    const result = login('mina', 'demo-only');
    expect(result.ok).toBe(true);
    expect(result.navigateTo).toBe(role === 'admin' ? '/admin' : '/blogs');
    expect(getSession()).toEqual({ userId: id, username: 'mina', displayName: 'Mina', role });
    expect(JSON.parse(localStorage.getItem('writespace_session'))).not.toHaveProperty('password');
  });
  it.each([
    [undefined, 'demo-only'], [null, 'demo-only'], [0, 'demo-only'], [false, 'demo-only'], [[], 'demo-only'], [{}, 'demo-only'],
    ['', 'demo-only'], ['  ', 'demo-only'], ['mina', undefined], ['mina', null], ['mina', false], ['mina', 0],
    ['mina', []], ['mina', {}], ['mina', ''], ['mina', ' \t '], ['missing', 'demo-only'], ['mina', 'wrong'],
    ['Mina', 'demo-only'], ['mina', 'Demo-only'], ['admin', 'wrong'], ['Admin', 'admin'],
  ])('rejects invalid pair %j / %j with exact copy and no state change', (username, password) => {
    saveUsers([user]);
    setSession(previous);
    const result = login(username, password);
    expect(result).toMatchObject({
      ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' },
      navigateTo: null, sessionWritten: false,
    });
    expect(getSession()).toEqual(previous);
    expect(getUsers()).toEqual([user]);
  });
  it.each(['id', 'displayName', 'role'])('ignores a credential match with invalid %s', field => {
    saveUsers([{ ...user, [field]: '' }]);
    expect(login('mina', 'demo-only').error.message).toBe('Invalid username or password.');
    expect(getSession()).toBeNull();
  });
  it.each(['missing', 'malformed', 'non-array', 'getter failure'])('rejects credentials when users are %s', state => {
    if (state === 'malformed') localStorage.setItem('writespace_users', 'broken');
    if (state === 'non-array') localStorage.setItem('writespace_users', '{}');
    if (state === 'getter failure') vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    expect(login('mina', 'demo-only').error.message).toBe('Invalid username or password.');
    vi.restoreAllMocks();
    expect(getSession()).toBeNull();
  });
  it.each(['user', 'admin'])('reports session write failure for matched %s without changing session/users', role => {
    saveUsers([user]);
    setSession(previous);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    const result = role === 'admin' ? login('admin', 'admin') : login('mina', 'demo-only');
    expect(result).toMatchObject({ ok: false, error: { code: 'STORAGE_WRITE_FAILED' }, sessionWritten: false, navigateTo: null });
    expect(getSession()).toEqual(previous);
    expect(getUsers()).toEqual([user]);
  });
});
