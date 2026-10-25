/** Verify every account-service validation, protection and persistence boundary. */
import { describe, expect, it, vi } from 'vitest';
import { adminCreateUser, adminDeleteUser, isCompleteUser, userDeletionReason } from '../src/utils/adminUsers';
import { DEFAULT_ADMIN } from '../src/utils/accountEntry';
import { getSession, setSession } from '../src/utils/auth';
import { getUsers, saveUsers } from '../src/utils/storage';

const id = '8fc787c4-78da-4f5e-9d74-93e9274892e8';
const date = '2026-01-15T12:00:00.000Z';
const input = { displayName: 'Mina', username: 'mina', password: 'demo-only', role: 'user' };
const account = { ...input, id, createdAt: date };
const boundaries = { randomUUID: () => id, now: () => date };
const badValues = [undefined, null, '', ' ', 42, false, {}, []];

/** Verify rejection leaves canonical accounts and identity untouched. */
function rejected(action, code) {
  const before = { users: localStorage.getItem('writespace_users'), session: getSession() };
  const write = vi.spyOn(Storage.prototype, 'setItem');
  expect(action()).toMatchObject({ ok: false, error: { code } });
  expect(localStorage.getItem('writespace_users')).toBe(before.users);
  expect(getSession()).toEqual(before.session);
  expect(write).not.toHaveBeenCalled();
  write.mockRestore();
}

it('explains fixed/active protections and permits other or absent identities', () => {
  expect(userDeletionReason(DEFAULT_ADMIN.userId, null)).toBe('Default admin cannot be deleted.');
  expect(userDeletionReason(id, { userId: id })).toBe('Active accounts cannot be deleted.');
  expect(userDeletionReason(id, DEFAULT_ADMIN)).toBe(''); expect(userDeletionReason(id, null)).toBe('');
});

describe('complete account schema', () => {
  it('accepts complete records for both roles and rejects malformed containers', () => {
    for (const role of ['user', 'admin']) expect(isCompleteUser({ ...account, role })).toBe(true);
    for (const row of [null, undefined, 42, false, 'bad', [], {}]) expect(isCompleteUser(row)).toBe(false);
  });
  it.each(['id', 'displayName', 'username', 'password', 'createdAt'])('validates every %s field', field => {
    for (const value of badValues) expect(isCompleteUser({ ...account, [field]: value })).toBe(false);
  });
  it.each([undefined, null, '', 'owner', 42, {}, []])('rejects invalid role %s', role => {
    expect(isCompleteUser({ ...account, role })).toBe(false);
  });
  it('rejects an invalid date', () => expect(isCompleteUser({ ...account, createdAt: 'not-a-date' })).toBe(false));
});

describe('Admin creation', () => {
  it.each(['user', 'admin'])('saves complete %s with UUID/time and preserves others and session', role => {
    const others = [null, { legacy: true }, { ...account, id: 'older', username: 'Older' }];
    saveUsers(others); setSession(DEFAULT_ADMIN);
    const uuid = vi.fn(boundaries.randomUUID); const now = vi.fn(boundaries.now);
    const result = adminCreateUser({ ...input, role }, getSession(), { randomUUID: uuid, now });
    expect(result).toEqual({ ok: true, value: { ...account, role } });
    expect(getUsers()).toEqual([...others, { ...account, role }]);
    expect(uuid).toHaveBeenCalledOnce(); expect(now).toHaveBeenCalledOnce();
    expect(getSession()).toEqual(DEFAULT_ADMIN);
    expect(getUsers().some(row => row?.id === DEFAULT_ADMIN.userId)).toBe(false);
  });
  it.each(['user', 'admin'])('preserves very-long and XSS-like fields exactly for %s without unrelated changes', role => {
    const others = [null, { legacy: true }, { ...account, id: 'older', username: 'Older' }];
    saveUsers(others); setSession(DEFAULT_ADMIN);
    localStorage.setItem('writespace_posts', '[{"id":"untouched","content":"Keep exact bytes"}]');
    localStorage.setItem('unrelated-setting', 'unchanged');
    const sessionBefore = localStorage.getItem('writespace_session');
    const postsBefore = localStorage.getItem('writespace_posts');
    const values = [
      { displayName: ` Name-${'N'.repeat(16384)} `, username: ` User-${'U'.repeat(16384)} `, password: ` Secret-${'P'.repeat(16384)} ` },
      { displayName: '<script>window.accountXss = true</script><img src=x onerror="window.accountXss = true">', username: '\"><img src=x onerror="window.accountXss = true"><script>window.accountXss = true</script>', password: 'Never-render-admin-secret' },
    ];
    const expected = [...others];
    for (const fields of values) {
      const result = adminCreateUser({ ...fields, role }, getSession());
      expect(result.ok).toBe(true);
      const saved = result.value;
      expect(saved.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
      expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
      const exact = { id: saved.id, ...fields, role, createdAt: saved.createdAt };
      expect(result).toEqual({ ok: true, value: exact });
      expected.push(exact);
      expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual(expected);
      expect(getUsers()).toEqual(expected);
      expect(new Set(expected.filter(row => row?.id).map(row => row.id)).size).toBe(expected.length - 2);
      expect(localStorage.getItem('writespace_session')).toBe(sessionBefore);
      expect(getSession()).toEqual(DEFAULT_ADMIN);
      expect(localStorage.getItem('writespace_posts')).toBe(postsBefore);
      expect(localStorage.getItem('unrelated-setting')).toBe('unchanged');
    }
  });
  it.each(['displayName', 'username', 'password'])('rejects all invalid %s values', field => {
    for (const value of badValues) rejected(() => adminCreateUser({ ...input, [field]: value }, DEFAULT_ADMIN), 'INVALID_INPUT');
  });
  it.each([null, undefined, false, 42, [], {}])('rejects missing/invalid input %s', value => {
    rejected(() => adminCreateUser(value, DEFAULT_ADMIN), 'INVALID_INPUT');
  });
  it.each([undefined, null, '', 'owner', 42, {}, []])('rejects role %s', role => {
    rejected(() => adminCreateUser({ ...input, role }, DEFAULT_ADMIN), 'INVALID_INPUT');
  });
  it.each([null, {}, [], { ...DEFAULT_ADMIN, role: 'user' }, { ...DEFAULT_ADMIN, userId: '' }])('denies caller %s', session => {
    rejected(() => adminCreateUser(input, session), 'UNAUTHORIZED');
    rejected(() => adminDeleteUser(id, session, true), 'UNAUTHORIZED');
  });
  it('collects every required field and role error', () => {
    expect(Object.keys(adminCreateUser({}, DEFAULT_ADMIN).fields)).toEqual(['displayName', 'username', 'password', 'role']);
  });
  it('rejects reserved name and duplicates even on malformed stored rows, but remains case-sensitive', () => {
    saveUsers([{ username: 'mina' }]);
    rejected(() => adminCreateUser(input, DEFAULT_ADMIN), 'USERNAME_TAKEN');
    rejected(() => adminCreateUser({ ...input, username: 'admin' }, DEFAULT_ADMIN), 'RESERVED_USERNAME');
    expect(adminCreateUser({ ...input, username: 'Admin' }, DEFAULT_ADMIN, boundaries).ok).toBe(true);
  });
  it.each([undefined, null, '', 'not-uuid', 42])('rejects unusable UUID %s', value => {
    rejected(() => adminCreateUser(input, DEFAULT_ADMIN, { randomUUID: () => value }), 'UUID_UNAVAILABLE');
  });
  it('handles UUID throw and missing capability', () => {
    rejected(() => adminCreateUser(input, DEFAULT_ADMIN, { randomUUID: () => { throw Error(); } }), 'UUID_UNAVAILABLE');
    vi.stubGlobal('crypto', {}); rejected(() => adminCreateUser(input, DEFAULT_ADMIN), 'UUID_UNAVAILABLE');
  });
  it.each([undefined, null, '', 'bad', 42, '2026-01-15'])('rejects unusable time %s', value => {
    rejected(() => adminCreateUser(input, DEFAULT_ADMIN, { ...boundaries, now: () => value }), 'TIME_UNAVAILABLE');
  });
  it('handles clock throw and ID collision', () => {
    rejected(() => adminCreateUser(input, DEFAULT_ADMIN, { ...boundaries, now: () => { throw Error(); } }), 'TIME_UNAVAILABLE');
    saveUsers([{ id }]); rejected(() => adminCreateUser(input, DEFAULT_ADMIN, boundaries), 'DUPLICATE_ID');
  });
  it('uses real UUID/ISO defaults and reads fresh arrays for sequential submissions', () => {
    setSession(DEFAULT_ADMIN);
    expect(adminCreateUser(input, getSession()).ok).toBe(true);
    expect(adminCreateUser({ ...input, username: 'next' }, getSession()).ok).toBe(true);
    expect(getUsers()).toHaveLength(2);
    for (const row of getUsers()) {
      expect(row.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
      expect(new Date(row.createdAt).toISOString()).toBe(row.createdAt);
    }
  });
});

describe('confirmed protected deletion', () => {
  it.each(badValues)('rejects invalid ID %s', value => rejected(() => adminDeleteUser(value, DEFAULT_ADMIN, true), 'INVALID_ID'));
  it.each([undefined, null, false, 1, 'true', {}])('requires true confirmation %s', confirmed => {
    saveUsers([account]); rejected(() => adminDeleteUser(id, DEFAULT_ADMIN, confirmed), 'CONFIRMATION_REQUIRED');
  });
  it('protects fixed Admin, caller and a different observable current account', () => {
    saveUsers([account]);
    rejected(() => adminDeleteUser(DEFAULT_ADMIN.userId, DEFAULT_ADMIN, true), 'DEFAULT_ADMIN_PROTECTED');
    rejected(() => adminDeleteUser(id, { ...DEFAULT_ADMIN, userId: id }, true), 'ACTIVE_ACCOUNT_PROTECTED');
    setSession({ userId: id, username: 'mina', displayName: 'Mina', role: 'user' });
    rejected(() => adminDeleteUser(id, DEFAULT_ADMIN, true), 'ACTIVE_ACCOUNT_PROTECTED');
  });
  it('rejects missing, malformed and duplicate targets without repairing others', () => {
    rejected(() => adminDeleteUser(id, DEFAULT_ADMIN, true), 'NOT_FOUND');
    for (const rows of [[{ id }], [account, { ...account }]]) {
      saveUsers(rows); rejected(() => adminDeleteUser(id, DEFAULT_ADMIN, true), 'INVALID_RECORD');
    }
  });
  it('retains records when the session boundary throws', () => {
    saveUsers([account]);
    rejected(() => adminDeleteUser(id, DEFAULT_ADMIN, true, { getSession: () => { throw Error(); } }), 'STORAGE_WRITE_FAILED');
  });
  it('re-reads before each delete and preserves all other records in a new array', () => {
    const rows = Object.freeze([null, account, { legacy: true }]); const save = vi.fn(() => true);
    expect(adminDeleteUser(id, DEFAULT_ADMIN, true, { getUsers: () => rows, saveUsers: save }).ok).toBe(true);
    expect(save.mock.calls[0][0]).toEqual([null, { legacy: true }]); expect(rows).toHaveLength(3);
    saveUsers([account]); expect(adminDeleteUser(id, DEFAULT_ADMIN, true).ok).toBe(true);
    rejected(() => adminDeleteUser(id, DEFAULT_ADMIN, true), 'NOT_FOUND');
  });
});

it.each(['create', 'delete'])('%s handles non-array reads, read throws, false/throwing writes without mutation', operation => {
  saveUsers(operation === 'create' ? [] : [account]); setSession(DEFAULT_ADMIN);
  const run = deps => operation === 'create' ? adminCreateUser(input, DEFAULT_ADMIN, { ...boundaries, ...deps })
    : adminDeleteUser(id, DEFAULT_ADMIN, true, deps);
  rejected(() => run({ getUsers: () => null }), 'INVALID_RECORDS');
  rejected(() => run({ getUsers: () => { throw Error(); } }), 'STORAGE_WRITE_FAILED');
  rejected(() => run({ saveUsers: () => false }), 'STORAGE_WRITE_FAILED');
  rejected(() => run({ saveUsers: () => { throw Error(); } }), 'STORAGE_WRITE_FAILED');
  const before = getUsers(); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
  expect(run({})).toMatchObject({ ok: false, error: { code: 'STORAGE_WRITE_FAILED' } }); expect(getUsers()).toEqual(before);
});
