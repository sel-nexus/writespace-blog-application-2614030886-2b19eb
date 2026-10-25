/** Verify every post mutation branch against freshly read browser storage. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canEditPost, createPost, deletePost, editPost } from '../src/utils/posts';
import { getPosts, savePosts } from '../src/utils/storage';
import { DEFAULT_ADMIN } from '../src/utils/accountEntry';
import { getSession, setSession } from '../src/utils/auth';

const owner = { userId: 'u1', username: 'mina', displayName: 'Mina', role: 'user' };
const other = { ...owner, userId: 'u2' };
const original = {
  id: 'p1', title: 'Original', content: 'First line\nSecond line',
  createdAt: '2026-01-15T12:00:00.000Z', authorId: 'u1', authorName: 'Original author', extra: { keep: true },
};
const unrelated = [null, 7, false, 'raw', [], { id: 'partial' }, { ...original, id: 'p2', authorId: 'u2' }];
const input = { title: ' Updated ', content: '  Body\n<script>literal</script> ' };
const deps = { uuid: () => '00000000-0000-4000-8000-000000000001', now: () => '2026-02-01T00:00:00.000Z' };
const invalidValues = [undefined, null, false, 0, 42, [], {}, '', ' \n\t'];
const badSessions = [undefined, null, false, 42, 'user', [], {},
  ...['userId', 'username', 'displayName', 'role'].flatMap(field => [
    { ...owner, [field]: undefined }, { ...owner, [field]: '' }, { ...owner, [field]: 7 },
  ]), { ...owner, role: 'owner' }];

beforeEach(() => {
  savePosts([original, ...unrelated]);
  setSession(owner);
});

/** Assert a failed result, zero writes, and unchanged raw and parsed persisted state. */
function rejected(run, code) {
  const raw = localStorage.getItem('writespace_posts');
  const before = getPosts();
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const result = run();
  expect(result).toMatchObject({ ok: false, error: { code }, persisted: false, navigateTo: null });
  expect(write).not.toHaveBeenCalled();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
  expect(getPosts()).toEqual(before);
  return result;
}

/** Exercise the same public operation with fresh injected or default browser boundaries. */
function operation(kind, overrides = {}) {
  if (kind === 'create') return createPost(input, owner, { ...deps, ...overrides });
  if (kind === 'edit') return editPost('p1', input, owner, overrides);
  return deletePost('p1', owner, true, overrides);
}

describe('shared domain authorization', () => {
  it.each([[owner, true], [other, false], [DEFAULT_ADMIN, true]])('checks actor %j', (session, allowed) => {
    const before = getPosts();
    expect(canEditPost(original, session)).toBe(allowed);
    expect(getPosts()).toEqual(before);
  });
  it.each(badSessions.map(session => [session]))('rejects invalid actor %j for all services', session => {
    rejected(() => createPost(input, session, deps), 'UNAUTHORIZED');
    rejected(() => editPost('p1', input, session), 'UNAUTHORIZED');
    rejected(() => deletePost('p1', session, true), 'UNAUTHORIZED');
    expect(canEditPost(original, session)).toBe(false);
  });
  it.each([null, false, [], {}, { ...original, createdAt: 'bad' }].map(row => [row]))('rejects malformed policy post %j', row => {
    const before = getPosts();
    expect(canEditPost(row, DEFAULT_ADMIN)).toBe(false);
    expect(getPosts()).toEqual(before);
  });
});

describe('required text', () => {
  for (const kind of ['create', 'edit']) {
    for (const field of ['title', 'content']) {
      it.each(invalidValues.map(value => [value]))(`${kind} rejects ${field} value %j`, value => {
        const patch = { ...input, [field]: value };
        const result = rejected(() => kind === 'create'
          ? createPost(patch, owner, deps) : editPost('p1', patch, owner), 'REQUIRED_FIELD');
        expect(result.error.field).toBe(field);
        expect(result.fields[field]).toBe(`${field === 'title' ? 'Title' : 'Content'} is required.`);
      });
    }
    it.each([undefined, null, false, 42, [], {}].map(value => [value]))(`${kind} rejects invalid whole input %j`, value => {
      const result = rejected(() => kind === 'create'
        ? createPost(value, owner, deps) : editPost('p1', value, owner), 'REQUIRED_FIELD');
      expect(result.fields).toEqual({ title: 'Title is required.', content: 'Content is required.' });
    });
    it(`${kind} accepts arbitrarily long nonblank text without trimming or executing it`, () => {
      const text = { title: ' '.repeat(3) + 'x'.repeat(10000), content: '<script>literal</script>\n' + 'y'.repeat(100000) };
      const result = kind === 'create' ? createPost(text, owner, deps) : editPost('p1', text, owner);
      expect(result.ok).toBe(true);
      expect(getPosts().find(row => row?.id === result.value.id)).toEqual(result.value);
      expect(result.value).toMatchObject(text);
      expect(getPosts().slice(1, kind === 'create' ? -1 : undefined)).toEqual(unrelated);
    });
  }
});

describe('create metadata and capability failures', () => {
  it.each([owner, DEFAULT_ADMIN])('appends fresh rows and ignores forged metadata for %j', session => {
    const fresh = { ...original, id: 'fresh' };
    savePosts([...unrelated, fresh]);
    const result = createPost({ ...input, id: 'forged', authorId: 'forged', authorName: 'forged', createdAt: 'bad' }, session, deps);
    const expected = {
      id: deps.uuid(), ...input, createdAt: deps.now(), authorId: session.userId, authorName: session.displayName,
    };
    expect(result).toEqual({ ok: true, value: expected, persisted: true, navigateTo: `/blog/${expected.id}` });
    expect(getPosts()).toEqual([...unrelated, fresh, expected]);
    expect(getSession()).toEqual(owner);
  });
  it('uses default browser UUID and ISO time at submission, with no module cache', () => {
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('browser-uuid');
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(deps.now());
    savePosts([]);
    const result = createPost(input, owner);
    expect(uuid).toHaveBeenCalledOnce();
    expect(getPosts()).toEqual([{ id: 'browser-uuid', ...input, createdAt: deps.now(), authorId: 'u1', authorName: 'Mina' }]);
    expect(result.value).toEqual(getPosts()[0]);
  });
  it.each([undefined, null, false, 7, '', '  '].map(value => [value]))('rejects unusable UUID %j before writing', value => {
    rejected(() => createPost(input, owner, { ...deps, uuid: () => value }), 'UUID_UNAVAILABLE');
  });
  it('surfaces a throwing UUID boundary', () => {
    rejected(() => createPost(input, owner, { ...deps, uuid: () => { throw new Error('UUID blocked'); } }), 'UUID_UNAVAILABLE');
  });
  it('surfaces absent browser UUID support', () => {
    vi.stubGlobal('crypto', {});
    rejected(() => createPost(input, owner), 'UUID_UNAVAILABLE');
  });
  it.each([undefined, null, false, 7, '', 'bad-date'].map(value => [value]))('rejects unusable time %j', value => {
    rejected(() => createPost(input, owner, { ...deps, now: () => value }), 'TIME_UNAVAILABLE');
  });
  it('surfaces throwing time generation separately from UUID errors', () => {
    rejected(() => createPost(input, owner, { ...deps, now: () => { throw new Error('Time blocked'); } }), 'TIME_UNAVAILABLE');
  });
  it('surfaces a default ISO-time exception', () => {
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => { throw new Error('Time blocked'); });
    rejected(() => createPost(input, owner, { uuid: deps.uuid }), 'TIME_UNAVAILABLE');
  });
});

describe('exact resolution and owner/Admin mutations', () => {
  for (const kind of ['edit', 'delete']) {
    it.each([undefined, null, false, 42, {}, [], '', 'missing', 'P1', 'p'].map(id => [id]))(`${kind} rejects nonexact id %j`, id => {
      rejected(() => kind === 'edit' ? editPost(id, input, owner) : deletePost(id, owner, true), 'NOT_FOUND');
    });
    it.each(['id', 'title', 'content', 'createdAt', 'authorId', 'authorName'])(`${kind} rejects malformed target field %s`, field => {
      savePosts([{ ...original, [field]: field === 'createdAt' ? 'bad' : null }, ...unrelated]);
      rejected(() => operation(kind), 'NOT_FOUND');
    });
    it(`${kind} rejects a different owner even with invalid patch`, () => {
      rejected(() => kind === 'edit' ? editPost('p1', {}, other) : deletePost('p1', other, true), 'UNAUTHORIZED');
    });
    it(`${kind} resolves fresh author changes rather than a prior owner snapshot`, () => {
      savePosts([{ ...original, authorId: 'new-owner' }, ...unrelated]);
      rejected(() => operation(kind), 'UNAUTHORIZED');
    });
    it(`${kind} rejects a second operation on an already removed record`, () => {
      expect(deletePost('p1', owner, true).ok).toBe(true);
      expect(getPosts()).toEqual(unrelated);
      rejected(() => operation(kind), 'NOT_FOUND');
    });
  }
  it.each([owner, DEFAULT_ADMIN])('edit replaces only permitted text for %j', session => {
    const result = editPost('p1', { ...input, id: 'forged', createdAt: 'bad', authorId: 'forged', extra: 'forged' }, session);
    expect(result).toEqual({ ok: true, value: { ...original, ...input }, persisted: true, navigateTo: '/blog/p1' });
    expect(getPosts()).toEqual([{ ...original, ...input }, ...unrelated]);
  });
  it('skips a malformed duplicate and edits only the first valid exact record', () => {
    const duplicate = { ...original, title: 'Second valid' };
    savePosts([{ id: 'p1' }, original, duplicate, ...unrelated]);
    expect(editPost('p1', input, owner).ok).toBe(true);
    expect(getPosts()).toEqual([{ id: 'p1' }, { ...original, ...input }, duplicate, ...unrelated]);
  });
  it('edit preserves a differently owned duplicate when updating the first valid match', () => {
    const duplicate = { ...original, title: 'Other owner story', authorId: other.userId };
    savePosts([original, duplicate, ...unrelated]);
    expect(editPost('p1', input, owner)).toMatchObject({ ok: true, value: { ...original, ...input } });
    expect(getPosts()).toEqual([{ ...original, ...input }, duplicate, ...unrelated]);
  });
  it.each([owner, DEFAULT_ADMIN])('delete rejects differently owned same-ID rows for %j without writing', session => {
    const duplicate = { ...original, title: 'Other owner story', authorId: other.userId };
    savePosts([original, duplicate, ...unrelated]);
    rejected(() => deletePost('p1', session, true), 'AMBIGUOUS_ID');
  });
  it.each([
    { id: 'p1' },
    { ...original, createdAt: 'bad' },
    { ...original, authorId: null },
  ].map(row => [row]))('delete rejects malformed same-ID row %j and preserves every raw row', duplicate => {
    savePosts([duplicate, original, ...unrelated]);
    rejected(() => deletePost('p1', owner, true), 'AMBIGUOUS_ID');
  });
  it('encodes edit destination without normalizing the exact stored id', () => {
    savePosts([{ ...original, id: 'a/b ?' }, ...unrelated]);
    const result = editPost('a/b ?', input, owner);
    expect(result.navigateTo).toBe('/blog/a%2Fb%20%3F');
    expect(getPosts()).toEqual([{ ...original, id: 'a/b ?', ...input }, ...unrelated]);
  });
  it.each([owner, DEFAULT_ADMIN])('confirmed delete removes target and preserves raw other rows for %j', session => {
    const result = deletePost('p1', session, true);
    expect(result).toEqual({ ok: true, value: null, persisted: true, removedId: 'p1', navigateTo: '/blogs' });
    expect(getPosts()).toEqual(unrelated);
  });
  it('Admin edits and deletes a different author', () => {
    expect(editPost('p2', input, DEFAULT_ADMIN).ok).toBe(true);
    expect(getPosts()).toEqual([original, ...unrelated.slice(0, -1), { ...unrelated.at(-1), ...input }]);
    expect(deletePost('p2', DEFAULT_ADMIN, true).ok).toBe(true);
    expect(getPosts()).toEqual([original, ...unrelated.slice(0, -1)]);
  });
  it.each([undefined, null, false, 0, 1, 'true', [], {}].map(value => [value]))('requires strict boolean confirmation %j', confirmed => {
    rejected(() => deletePost('p1', owner, confirmed), 'CONFIRMATION_REQUIRED');
  });
  it('uses the freshly read session after identity changes', () => {
    setSession(other);
    rejected(() => editPost('p1', input, getSession()), 'UNAUTHORIZED');
    rejected(() => deletePost('p1', getSession(), true), 'UNAUTHORIZED');
    localStorage.removeItem('writespace_session');
    rejected(() => createPost(input, getSession(), deps), 'UNAUTHORIZED');
  });
});

describe('persistence is required before success', () => {
  for (const kind of ['create', 'edit', 'delete']) {
    it.each([false, undefined, null, 1, 'true'].map(value => [value]))(`${kind} rejects nonboolean save result %j`, value => {
      rejected(() => operation(kind, { savePosts: () => value }), 'STORAGE_WRITE_FAILED');
    });
    it(`${kind} catches an injected writer exception and retains persisted rows`, () => {
      rejected(() => operation(kind, { savePosts: () => { throw new Error('Blocked'); } }), 'STORAGE_WRITE_FAILED');
    });
    it(`${kind} surfaces a real browser setter failure without reporting success`, () => {
      const before = getPosts();
      const raw = localStorage.getItem('writespace_posts');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
      expect(operation(kind)).toMatchObject({ ok: false, error: { code: 'STORAGE_WRITE_FAILED' }, persisted: false });
      expect(getPosts()).toEqual(before);
      expect(localStorage.getItem('writespace_posts')).toBe(raw);
    });
    it(`${kind} accepts explicit injected storage boundaries and verifies the stored array`, () => {
      const result = operation(kind, { getPosts, savePosts });
      expect(result.ok).toBe(true);
      if (kind === 'create') expect(getPosts()).toEqual([original, ...unrelated, result.value]);
      else if (kind === 'edit') expect(getPosts()).toEqual([{ ...original, ...input }, ...unrelated]);
      else expect(getPosts()).toEqual(unrelated);
    });
  }
});
