/** Verify explicit writing and deletion events through real routes and local storage. */
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '../src/App';
import WriteBlog from '../src/pages/WriteBlog';
import { DEFAULT_ADMIN } from '../src/utils/accountEntry';
import { getPosts, savePosts } from '../src/utils/storage';
import { setSession } from '../src/utils/auth';

const owner = { userId: 'u1', username: 'mina', displayName: 'Mina', role: 'user' };
const other = { ...owner, userId: 'u2', displayName: 'Other' };
const original = {
  id: 'p1', title: 'Original story', content: 'First line\nSecond line',
  createdAt: '2026-01-15T12:00:00.000Z', authorId: 'u1', authorName: 'Original author',
};
const remaining = [null, { id: 'raw-row' }, { ...original, id: 'p2', title: 'Another story', authorId: 'u2' }];
const uuid = '00000000-0000-4000-8000-000000000001';

/** Seed real browser records and render the protected shell in StrictMode. */
function mount(path = '/write', session = owner, rows = [original, ...remaining]) {
  savePosts(rows);
  if (session) setSession(session);
  const view = render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
  return { ...view, actor: userEvent.setup() };
}

/** Enter title and multiline body through stable accessible fields. */
async function fill(actor, title = 'New story', content = 'New body\nSecond line') {
  const titleField = screen.getByRole('textbox', { name: 'Title', exact: true });
  const bodyField = screen.getByRole('textbox', { name: 'Content', exact: true });
  await actor.clear(titleField);
  await actor.type(titleField, title);
  await actor.clear(bodyField);
  await actor.type(bodyField, content);
}

/** Assert that saved detail displays the exact plain-text record. */
function detail(post) {
  expect(screen.getByRole('heading', { level: 1, name: post.title })).toBeVisible();
  expect(document.querySelector('.whitespace-pre-wrap').textContent).toBe(post.content);
}

describe('writing form', () => {
  it.each(['/write', '/edit/p1'])('does not mutate records or identities during %s render', path => {
    savePosts([original, ...remaining]);
    setSession(owner);
    const raw = localStorage.getItem('writespace_posts');
    const identity = localStorage.getItem('writespace_session');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(path === '/write' ? '' : original.title);
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue(path === '/write' ? '' : original.content);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    expect(localStorage.getItem('writespace_session')).toBe(identity);
    expect(getPosts()).toEqual([original, ...remaining]);
  });
  it('collects both required errors with aria associations and updates the content counter without writing', async () => {
    const { actor } = mount();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const title = screen.getByRole('textbox', { name: 'Title' });
    const content = screen.getByRole('textbox', { name: 'Content' });
    expect(title).toBeRequired();
    expect(content).toBeRequired();
    expect(content.tagName).toBe('TEXTAREA');
    expect(content).toHaveClass('min-h-64');
    expect(screen.getByRole('status')).toHaveTextContent('0 characters');
    await actor.click(screen.getByRole('button', { name: 'Publish Blog' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAttribute('aria-describedby', 'title-error');
    expect(title).toHaveAccessibleDescription('Title is required.');
    expect(content).toHaveAttribute('aria-invalid', 'true');
    expect(content).toHaveAttribute('aria-describedby', 'content-error content-count');
    expect(content).toHaveAccessibleDescription('Content is required. 0 characters');
    await actor.type(content, 'abc\ndef');
    expect(screen.getByRole('status')).toHaveTextContent('7 characters');
    await actor.type(title, '   ');
    await actor.click(screen.getByRole('button', { name: 'Publish Blog' }));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(content).toHaveAttribute('aria-invalid', 'false');
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([original, ...remaining]);
  });
  it.each([owner, DEFAULT_ADMIN])('creates with current actor metadata and opens persisted detail for %j', async session => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(uuid);
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-02-01T00:00:00.000Z');
    const { actor } = mount('/write', session);
    await fill(actor);
    expect(getPosts()).toEqual([original, ...remaining]);
    await actor.click(screen.getByRole('button', { name: 'Publish Blog' }));
    const saved = {
      id: uuid, title: 'New story', content: 'New body\nSecond line', createdAt: '2026-02-01T00:00:00.000Z',
      authorId: session.userId, authorName: session.displayName,
    };
    detail(saved);
    expect(getPosts()).toEqual([original, ...remaining, saved]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('cancel create returns unsaved to the real collection', async () => {
    const { actor } = mount();
    await fill(actor);
    await actor.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
    expect(getPosts()).toEqual([original, ...remaining]);
    expect(screen.queryByRole('heading', { name: 'New story' })).not.toBeInTheDocument();
  });
  it.each(['uuid', 'time', 'save'])('retains entered create text and an alert after %s failure', async failure => {
    const { actor } = mount();
    await fill(actor);
    if (failure === 'uuid') {
      vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => { throw new Error('UUID blocked'); });
    } else if (failure === 'time') {
      vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => { throw new Error('Clock blocked'); });
    } else {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    }
    await actor.click(screen.getByRole('button', { name: 'Publish Blog' }));
    expect(screen.getByRole('heading', { name: 'Write a Blog' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('New story');
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('New body\nSecond line');
    expect(screen.getByRole('alert')).toHaveTextContent(failure === 'uuid'
      ? 'UUID support is unavailable' : failure === 'time' ? 'creation time' : 'Could not save');
    expect(getPosts()).toEqual([original, ...remaining]);
  });
  it('uses a changed valid identity for create instead of the displayed old identity', async () => {
    const { actor } = mount();
    await fill(actor);
    setSession(other);
    await actor.click(screen.getByRole('button', { name: 'Publish Blog' }));
    const saved = getPosts().at(-1);
    expect(saved).toMatchObject({ title: 'New story', content: 'New body\nSecond line', authorId: 'u2', authorName: 'Other' });
    expect(getPosts().slice(0, -1)).toEqual([original, ...remaining]);
    detail(saved);
  });
});

describe('edit form and route gates', () => {
  it.each(['required fields', 'save failure'])('resets %s, prefill and counter across same-instance edit/edit/write links', async failure => {
    const second = { ...remaining.at(-1), content: 'Different second post body\nWith another line' };
    const rows = [original, ...remaining.slice(0, -1), second];
    savePosts(rows);
    setSession(DEFAULT_ADMIN);
    const raw = localStorage.getItem('writespace_posts');
    const identity = localStorage.getItem('writespace_session');
    const users = localStorage.getItem('writespace_users');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const actor = userEvent.setup();
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/edit/p1']}>
          <nav aria-label="Writing test routes">
            <Link to="/edit/p2">Edit second post</Link>
            <Link to="/write">Start blank post</Link>
          </nav>
          <Routes>
            {/* One route element keeps WriteBlog mounted as the id changes or disappears. */}
            <Route path="/:mode/:id?" element={<WriteBlog session={DEFAULT_ADMIN} />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );
    const title = screen.getByRole('textbox', { name: 'Title', exact: true });
    const content = screen.getByRole('textbox', { name: 'Content', exact: true });

    /** Check both reset state and retained DOM identity, ruling out a remounted form. */
    function resetState(post) {
      expect(screen.getByRole('textbox', { name: 'Title', exact: true })).toBe(title);
      expect(screen.getByRole('textbox', { name: 'Content', exact: true })).toBe(content);
      expect(title).toHaveValue(post?.title ?? '');
      expect(content).toHaveValue(post?.content ?? '');
      expect(screen.getByRole('status')).toHaveTextContent(`${post?.content.length ?? 0} characters`);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(title).toHaveAttribute('aria-invalid', 'false');
      expect(content).toHaveAttribute('aria-invalid', 'false');
      expect(title).not.toHaveAttribute('aria-describedby');
      expect(content).toHaveAttribute('aria-describedby', 'content-count');
      expect(localStorage.getItem('writespace_posts')).toBe(raw);
      expect(localStorage.getItem('writespace_session')).toBe(identity);
      expect(localStorage.getItem('writespace_users')).toBe(users);
      expect(getPosts()).toEqual(rows);
    }

    /** Dirty the current form and produce the selected error without a durable write. */
    async function dirtyWithError() {
      await actor.clear(title);
      await actor.clear(content);
      if (failure === 'save failure') {
        await actor.type(title, 'Unsaved title');
        await actor.type(content, 'Unsaved body\nDo not carry forward');
        write.mockImplementation(() => { throw new Error('Quota'); });
      }
      await actor.click(screen.getByRole('button', { name: 'Save Changes', exact: true }));
      if (failure === 'required fields') {
        expect(screen.getAllByRole('alert')).toHaveLength(2);
        expect(title).toHaveAttribute('aria-invalid', 'true');
        expect(content).toHaveAttribute('aria-invalid', 'true');
        await actor.type(content, 'Unsaved body');
      } else {
        expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
      }
      expect(screen.getByRole('status')).toHaveTextContent(`${content.value.length} characters`);
      expect(localStorage.getItem('writespace_posts')).toBe(raw);
    }

    resetState(original);
    await dirtyWithError();
    await actor.click(screen.getByRole('link', { name: 'Edit second post' }));
    resetState(second);
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/blog/p2');
    await dirtyWithError();
    await actor.click(screen.getByRole('link', { name: 'Start blank post' }));
    resetState(null);
    expect(screen.getByRole('heading', { name: 'Write a Blog' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publish Blog' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/blogs');
    expect(write).toHaveBeenCalledTimes(failure === 'save failure' ? 2 : 0);
    expect(remove).not.toHaveBeenCalled();
  });
  it.each([owner, DEFAULT_ADMIN])('prefills and saves only text, preserving metadata for %j', async session => {
    const { actor } = mount('/edit/p1', session);
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(original.title);
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue(original.content);
    expect(screen.getByRole('status')).toHaveTextContent(`${original.content.length} characters`);
    await fill(actor);
    await actor.click(screen.getByRole('button', { name: 'Save Changes' }));
    detail({ ...original, title: 'New story', content: 'New body\nSecond line' });
    expect(getPosts()).toEqual([{ ...original, title: 'New story', content: 'New body\nSecond line' }, ...remaining]);
  });
  it('Admin edits another author without rewriting attribution', async () => {
    const { actor } = mount('/edit/p2', DEFAULT_ADMIN);
    await fill(actor);
    await actor.click(screen.getByRole('button', { name: 'Save Changes' }));
    const saved = { ...remaining.at(-1), title: 'New story', content: 'New body\nSecond line' };
    detail(saved);
    expect(getPosts()).toEqual([original, ...remaining.slice(0, -1), saved]);
  });
  it('cancel edit returns to unchanged persisted detail', async () => {
    const { actor } = mount('/edit/p1');
    await fill(actor);
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/blog/p1');
    await actor.click(screen.getByRole('link', { name: 'Cancel' }));
    detail(original);
    expect(getPosts()).toEqual([original, ...remaining]);
  });
  it('validates empty edit text and retains original persisted fields', async () => {
    const { actor } = mount('/edit/p1');
    await actor.clear(screen.getByRole('textbox', { name: 'Title' }));
    await actor.clear(screen.getByRole('textbox', { name: 'Content' }));
    await actor.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Edit Blog' })).toBeVisible();
    expect(getPosts()).toEqual([original, ...remaining]);
  });
  it('failed edit save stays on the form with unsaved text', async () => {
    const { actor } = mount('/edit/p1');
    await fill(actor);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    await actor.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('New story');
    expect(getPosts()).toEqual([original, ...remaining]);
  });
  it('denies a direct other-owner edit before displaying any form or writing', () => {
    savePosts([original, ...remaining]);
    setSession(other);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    render(<MemoryRouter initialEntries={['/edit/p1']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([original, ...remaining]);
  });
  it.each(['/write', '/edit/p1'])('guest %s redirects to login without creating posts', path => {
    const { container } = mount(path, null);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(container.querySelector('textarea')).toBeNull();
    expect(getPosts()).toEqual([original, ...remaining]);
  });
  it.each([[], [null, { id: 'missing' }], [{ ...original, id: 'missing', createdAt: 'bad' }]].map(rows => [rows]))(
    'missing edit %j has exact feedback and an actionable back link', async rows => {
      const { actor } = mount('/edit/missing', owner, rows);
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Post not found');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(getPosts()).toEqual(rows);
      await actor.click(screen.getByRole('link', { name: 'Back to All Blogs' }));
      expect(screen.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
      expect(getPosts()).toEqual(rows);
    },
  );
  it.each([null, other])('rejects stale identity %j on edit submit while retaining the form', async session => {
    const { actor } = mount('/edit/p1');
    await fill(actor);
    if (session) setSession(session);
    else localStorage.removeItem('writespace_session');
    await actor.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent(session ? 'You cannot change' : 'Sign in');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('New story');
    expect(getPosts()).toEqual([original, ...remaining]);
  });
  it.each(['removed', 'new-owner'])('rejects a stale %s edit record and retains unsaved fields', async change => {
    const { actor } = mount('/edit/p1');
    await fill(actor);
    const fresh = change === 'removed' ? remaining : [{ ...original, authorId: 'u2' }, ...remaining];
    savePosts(fresh);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await actor.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByRole('heading', { name: 'Edit Blog' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(change === 'removed' ? 'Post not found' : 'You cannot change');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('New story');
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('New body\nSecond line');
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual(fresh);
  });
  it('rejects a lost create session without navigating as saved', async () => {
    const { actor } = mount();
    await fill(actor);
    localStorage.removeItem('writespace_session');
    await actor.click(screen.getByRole('button', { name: 'Publish Blog' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('New story');
    expect(getPosts()).toEqual([original, ...remaining]);
  });
});

describe('read-detail confirmed deletion', () => {
  it.each([[owner, 'p1', true], [other, 'p1', false], [DEFAULT_ADMIN, 'p2', true]])(
    'shows delete only for authorized actor %j on %s', (session, id, allowed) => {
      mount(`/blog/${id}`, session);
      if (allowed) expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
      else expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      expect(getPosts()).toEqual([original, ...remaining]);
    },
  );
  it('cancel confirmation makes no write and retains detail', async () => {
    const { actor } = mount('/blog/p1');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await actor.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirm).toHaveBeenCalledWith('Delete this post? This cannot be undone.');
    detail(original);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([original, ...remaining]);
  });
  it.each([[owner, 'p1'], [DEFAULT_ADMIN, 'p2']])('confirmed actor %j deletes %s then opens the collection', async (session, id) => {
    const { actor } = mount(`/blog/${id}`, session);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await actor.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
    expect(getPosts()).toEqual([original, ...remaining].filter(row => row?.id !== id));
    expect(screen.queryByRole('heading', { name: id === 'p1' ? original.title : 'Another story' })).not.toBeInTheDocument();
  });
  it('failed deletion retains detail and error, including on later cancelled confirmation', async () => {
    const { actor } = mount('/blog/p1');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    await actor.click(screen.getByRole('button', { name: 'Delete' }));
    detail(original);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(getPosts()).toEqual([original, ...remaining]);
    confirm.mockReturnValue(false);
    await actor.click(screen.getByRole('button', { name: 'Delete' }));
    detail(original);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(getPosts()).toEqual([original, ...remaining]);
  });
  it.each([null, other])('rechecks changed session %j after confirmation before deletion', async session => {
    const { actor } = mount('/blog/p1');
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (session) setSession(session);
      else localStorage.removeItem('writespace_session');
      return true;
    });
    await actor.click(screen.getByRole('button', { name: 'Delete' }));
    detail(original);
    expect(screen.getByRole('alert')).toHaveTextContent(session ? 'You cannot change' : 'Sign in');
    expect(getPosts()).toEqual([original, ...remaining]);
  });
  it('rechecks the freshly stored post owner before deleting', async () => {
    const { actor } = mount('/blog/p1');
    const fresh = { ...original, authorId: 'u2' };
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      savePosts([fresh, ...remaining]);
      return true;
    });
    await actor.click(screen.getByRole('button', { name: 'Delete' }));
    detail(fresh);
    expect(screen.getByRole('alert')).toHaveTextContent('You cannot change');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(getPosts()).toEqual([fresh, ...remaining]);
  });
  it('rechecks a removed record and shows not-found feedback instead of saving again', async () => {
    const { actor } = mount('/blog/p1');
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      savePosts(remaining);
      return true;
    });
    await actor.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Post not found');
    expect(getPosts()).toEqual(remaining);
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Back to All Blogs' })).toBeVisible();
  });
});
