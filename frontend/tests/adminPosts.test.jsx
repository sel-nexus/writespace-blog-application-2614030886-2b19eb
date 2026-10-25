/** Exercise Admin overview projections, route policy, and explicit persisted actions. */
import { StrictMode } from 'react';
import PropTypes from 'prop-types';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Article } from '@phosphor-icons/react';
import App from '../src/App';
import StatCard, { StatCard as NamedStatCard } from '../src/components/StatCard';
import { DEFAULT_ADMIN } from '../src/utils/accountEntry';
import { setSession } from '../src/utils/auth';
import { getPosts, getUsers, savePosts, saveUsers } from '../src/utils/storage';

const writer = { userId: 'writer', username: 'writer', displayName: 'Writer', role: 'user' };
const account = {
  id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo-only', role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Build a complete post with deterministic recency and another author's attribution. */
function post(day, authorId = 'writer') {
  return {
    id: `p${day}`, title: `Story ${day}`, content: `Body ${day}\nSecond line`, authorId,
    authorName: authorId === DEFAULT_ADMIN.userId ? 'Admin' : 'Writer',
    createdAt: `2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`,
  };
}

/** Mount the real route shell without seeding or repairing storage during render. */
function mount(path = '/admin') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
}

/** Seed explicit records before rendering and return a user-event actor. */
function seed(rows = [], users = []) {
  savePosts(rows);
  saveUsers(users);
  setSession(DEFAULT_ADMIN);
  return userEvent.setup();
}

/** Resolve the definition value associated with an exact case-sensitive label. */
function metric(label) {
  return within(screen.getByRole('region', { name: 'Dashboard statistics' })).getByText(label, { exact: true })
    .nextElementSibling;
}

/** Scope row actions to the selected post rather than a global button position. */
function row(title) {
  return screen.getByRole('heading', { level: 3, name: title }).closest('li');
}

/** Read canonical storage, including metadata and malformed rows, for durable assertions. */
function records() {
  return {
    posts: getPosts(), users: getUsers(), session: JSON.parse(localStorage.getItem('writespace_session')),
  };
}

/** Confirm that a rejected removal retains both the dashboard and selected row. */
function retained(title, message) {
  expect(screen.getByRole('heading', { level: 1, name: 'Admin Dashboard' })).toBeVisible();
  expect(row(title)).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
}

describe('Admin dashboard metrics and recent projection', () => {
  it.each([0, 1, 5, 6])('counts %i posts and displays only the newest five without render writes', count => {
    const rows = Array.from({ length: count }, (_, index) => post(index + 1));
    seed(rows);
    const before = records();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    mount();
    const stats = screen.getByRole('region', { name: 'Dashboard statistics' });
    expect(Array.from(stats.querySelectorAll('dt'), node => node.textContent)).toEqual([
      'Total Posts', 'Total Users', 'Total Admins', 'Total users',
    ]);
    expect(metric('Total Posts')).toHaveTextContent(String(count));
    expect(metric('Total Users')).toHaveTextContent('1');
    expect(metric('Total Admins').textContent).toBe('—');
    expect(metric('Total users').textContent).toBe('—');
    expect(screen.getByText(/Total Posts counts valid displayed posts/)).toHaveTextContent(
      'Total Users counts complete stored accounts plus the fixed Admin.',
    );
    expect(screen.getByText(/Total Admins and Total users are undefined/)).toHaveTextContent('rather than invented counts');
    const recent = within(screen.getByRole('region', { name: 'Recent Posts' }));
    expect(recent.queryAllByRole('heading', { level: 3 }).map(node => node.textContent)).toEqual(
      rows.slice().reverse().slice(0, 5).map(item => item.title),
    );
    expect(recent.queryAllByRole('button', { name: 'Delete' })).toHaveLength(Math.min(count, 5));
    if (count === 0) expect(recent.getByText('No posts yet.')).toBeVisible();
    expect(stats).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-4');
    expect(screen.getByRole('heading', { level: 1 }).parentElement).toHaveClass('from-violet-700', 'to-indigo-700');
    expect(screen.getByRole('main')).not.toHaveClass('bg-gradient-to-r');
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(records()).toEqual(before);
  });

  it.each(['user', 'admin'])('includes complete stored %s accounts in Total Users without assigning undefined metrics', role => {
    seed([], [account, { ...account, id: 'second', username: 'second', role }]);
    mount();
    expect(metric('Total Users').textContent).toBe('3');
    expect(metric('Total Admins').textContent).toBe('—');
    expect(metric('Total users').textContent).toBe('—');
    expect(screen.queryByText(account.password)).not.toBeInTheDocument();
  });

  it('filters every missing or unusable account field without repairing raw rows', () => {
    const bad = [null, 42, 'bad', [], {}, { ...account, role: 'owner' }, { ...account, createdAt: 'invalid' }];
    for (const key of ['id', 'displayName', 'username', 'password', 'createdAt']) {
      const missing = { ...account };
      delete missing[key];
      bad.push(missing, { ...account, [key]: ' ' }, { ...account, [key]: 42 });
    }
    seed([], [account, ...bad]);
    const before = records();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    expect(metric('Total Users').textContent).toBe('2');
    expect(records()).toEqual(before);
    expect(write).not.toHaveBeenCalled();
  });

  it('filters malformed posts, preserves recency ties, and escapes text with encoded destinations', () => {
    const first = { ...post(3), id: 'a/b', title: '<script>literal</script>' };
    const tie = { ...post(3), id: 'tie', title: 'Tie story' };
    const bad = [null, 42, 'bad', [], {}, { ...post(10), createdAt: 'invalid' }];
    for (const key of ['id', 'title', 'content', 'createdAt', 'authorId', 'authorName']) {
      bad.push({ ...post(10), [key]: ' ' }, { ...post(10), [key]: {} });
    }
    seed([post(1), first, tie, ...bad]);
    const before = records();
    mount();
    expect(metric('Total Posts').textContent).toBe('3');
    expect(within(screen.getByRole('region', { name: 'Recent Posts' })).getAllByRole('heading', { level: 3 })
      .map(node => node.textContent)).toEqual([first.title, tie.title, 'Story 1']);
    expect(within(row(first.title)).getByRole('link', { name: first.title })).toHaveAttribute('href', '/blog/a%2Fb');
    expect(within(row(first.title)).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/edit/a%2Fb');
    expect(document.querySelector('script')).toBeNull();
    expect(records()).toEqual(before);
  });

  it.each(['{broken', 'null', '{}', '42'])('handles unusable arrays %s without replacing browser data', raw => {
    seed();
    localStorage.setItem('writespace_posts', raw);
    localStorage.setItem('writespace_users', raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    expect(metric('Total Posts').textContent).toBe('0');
    expect(metric('Total Users').textContent).toBe('1');
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    expect(localStorage.getItem('writespace_users')).toBe(raw);
    expect(write).not.toHaveBeenCalled();
  });

  it('missing post and account keys show zero posts and only the fixed Admin without writes', () => {
    setSession(DEFAULT_ADMIN);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    mount();
    expect(metric('Total Posts').textContent).toBe('0');
    expect(metric('Total Users').textContent).toBe('1');
    expect(localStorage.getItem('writespace_posts')).toBeNull();
    expect(localStorage.getItem('writespace_users')).toBeNull();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('falls back safely when post and account reads throw', () => {
    seed();
    const get = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function read(key) {
      if (key !== 'writespace_session') throw new Error('Blocked');
      return get.call(this, key);
    });
    mount();
    expect(metric('Total Posts').textContent).toBe('0');
    expect(metric('Total Users').textContent).toBe('1');
    expect(screen.getByText('No posts yet.')).toBeVisible();
  });
});

describe('Admin destinations and access policy', () => {
  it('exposes exactly the specified quick links and activates the write destination', async () => {
    const actor = seed();
    mount();
    const actions = within(screen.getByRole('region', { name: 'Quick Actions' }));
    expect(actions.getAllByRole('link').map(link => [link.textContent.trim(), link.getAttribute('href')])).toEqual([
      ['Write New Post', '/write'], ['Manage Users', '/users'],
    ]);
    await actor.click(actions.getByRole('link', { name: 'Write New Post' }));
    expect(screen.getByRole('heading', { name: 'Write a Blog' })).toBeVisible();
  });

  it('All Blogs reaches older posts and Admin can edit another author then return through Dashboard', async () => {
    const rows = Array.from({ length: 6 }, (_, index) => post(index + 1));
    const actor = seed(rows, [account]);
    mount();
    const recent = within(screen.getByRole('region', { name: 'Recent Posts' }));
    expect(recent.queryByRole('heading', { name: 'Story 1' })).not.toBeInTheDocument();
    expect(recent.getByRole('link', { name: 'All Blogs' })).toHaveAttribute('href', '/blogs');
    await actor.click(recent.getByRole('link', { name: 'All Blogs' }));
    expect(screen.getAllByRole('article')).toHaveLength(6);
    const older = screen.getByRole('heading', { name: 'Story 1' }).closest('article');
    await actor.click(within(older).getByRole('link', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit Blog' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue(rows[0].content);
    await actor.clear(screen.getByRole('textbox', { name: 'Title' }));
    await actor.type(screen.getByRole('textbox', { name: 'Title' }), 'Edited older story');
    await actor.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Edited older story' })).toBeVisible();
    expect(getPosts()).toEqual([{ ...rows[0], title: 'Edited older story' }, ...rows.slice(1)]);
    const nav = within(screen.getByRole('navigation', { name: 'Account navigation' }));
    expect(nav.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
    await actor.click(nav.getByRole('button', { name: 'Account for Admin' }));
    expect(nav.getAllByRole('link', { name: 'Dashboard', exact: true })).toHaveLength(1);
    await actor.click(nav.getByRole('link', { name: 'Dashboard', exact: true }));
    expect(screen.getByRole('heading', { level: 1, name: 'Admin Dashboard' })).toBeVisible();
    expect(nav.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(metric('Total Posts').textContent).toBe('6');
  });

  it('recent rows provide Edit and Delete for Admin and regular authors', async () => {
    const actor = seed([post(1, DEFAULT_ADMIN.userId), post(2)]);
    mount();
    for (const day of [1, 2]) {
      expect(within(row(`Story ${day}`)).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `/edit/p${day}`);
      expect(within(row(`Story ${day}`)).getByRole('button', { name: 'Delete' })).toBeVisible();
    }
    await actor.click(within(row('Story 2')).getByRole('link', { name: 'Edit' }));
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Story 2');
  });

  it.each([null, writer, { ...writer, role: 'owner' }])('guards direct Admin access for %j without session changes', identity => {
    savePosts([post(1)]);
    saveUsers([account]);
    if (identity) localStorage.setItem('writespace_session', JSON.stringify(identity));
    const before = records();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    mount();
    expect(screen.getByRole('heading', { level: 1, name: identity?.role === 'user' ? 'All Blogs' : 'Welcome back' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Dashboard statistics' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users', exact: true })).not.toBeInTheDocument();
    expect(records()).toEqual(before);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('Admin explicit deletion', () => {
  it('cancel keeps records, recent rows and count with feedback, and never writes', async () => {
    const actor = seed([post(1), post(2)], [account]);
    mount();
    const before = records();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await actor.click(within(row('Story 2')).getByRole('button', { name: 'Delete' }));
    retained('Story 2', 'Deletion cancelled. No changes were made.');
    expect(confirm).toHaveBeenCalledWith('Delete this post? This cannot be undone.');
    expect(metric('Total Posts').textContent).toBe('2');
    expect(records()).toEqual(before);
    expect(write).not.toHaveBeenCalled();
  });

  it.each([1, 6])('confirmed any-author deletion refreshes %i posts from fresh storage and survives remount', async count => {
    const rows = Array.from({ length: count }, (_, index) => post(index + 1));
    const actor = seed([...rows, null, { id: 'raw-row' }], [account]);
    const view = mount();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const added = post(20);
    savePosts([...getPosts(), added]);
    await actor.click(within(row(`Story ${count}`)).getByRole('button', { name: 'Delete' }));
    const expected = [...rows.slice(0, -1), null, { id: 'raw-row' }, added];
    expect(records()).toEqual({ posts: expected, users: [account], session: DEFAULT_ADMIN });
    expect(metric('Total Posts').textContent).toBe(String(count));
    expect(screen.queryByRole('heading', { name: `Story ${count}`, exact: true })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Recent Posts' })).getAllByRole('heading', { level: 3 })
      .map(node => node.textContent)).toEqual([added, ...rows.slice(0, -1).reverse()].slice(0, 5).map(item => item.title));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    view.unmount();
    mount();
    expect(metric('Total Posts').textContent).toBe(String(count));
    expect(records()).toEqual({ posts: expected, users: [account], session: DEFAULT_ADMIN });
  });

  it('deleting the only post renders the real zero state', async () => {
    const actor = seed([post(1)]);
    mount();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await actor.click(within(row('Story 1')).getByRole('button', { name: 'Delete' }));
    expect(metric('Total Posts').textContent).toBe('0');
    expect(screen.getByText('No posts yet.')).toBeVisible();
    expect(getPosts()).toEqual([]);
  });

  it('failed setter retains post and metadata; a subsequent successful retry clears the error', async () => {
    const actor = seed([post(1), post(2)], [account]);
    mount();
    const before = records();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    await actor.click(within(row('Story 2')).getByRole('button', { name: 'Delete' }));
    retained('Story 2', 'Could not save this change');
    expect(metric('Total Posts').textContent).toBe('2');
    expect(records()).toEqual(before);
    write.mockRestore();
    await actor.click(within(row('Story 2')).getByRole('button', { name: 'Delete' }));
    expect(getPosts()).toEqual([post(1)]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([null, writer, { ...writer, userId: 'different' }])('rejects fresh non-Admin identity %j despite displayed Admin', async identity => {
    const actor = seed([post(1)], [account]);
    mount();
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (identity) setSession(identity);
      else localStorage.removeItem('writespace_session');
      return true;
    });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await actor.click(within(row('Story 1')).getByRole('button', { name: 'Delete' }));
    retained('Story 1', 'Sign in as Admin');
    expect(getPosts()).toEqual([post(1)]);
    expect(getUsers()).toEqual([account]);
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(identity);
    expect(write.mock.calls.filter(([key]) => key === 'writespace_posts')).toHaveLength(0);
  });

  it('uses a fresh changed Admin identity instead of requiring the displayed account', async () => {
    const actor = seed([post(1)]);
    mount();
    const current = { ...DEFAULT_ADMIN, userId: 'local-admin', username: 'local-admin', displayName: 'Local Admin' };
    setSession(current);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await actor.click(within(row('Story 1')).getByRole('button', { name: 'Delete' }));
    expect(records()).toEqual({ posts: [], users: [], session: current });
    expect(screen.getByText('No posts yet.')).toBeVisible();
  });

  it('a removed record never overwrites current arrays or falsely removes the displayed row', async () => {
    const actor = seed([post(1), post(2)], [account]);
    mount();
    savePosts([post(1)]);
    const before = records();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await actor.click(within(row('Story 2')).getByRole('button', { name: 'Delete' }));
    retained('Story 2', 'Post not found');
    expect(metric('Total Posts').textContent).toBe('2');
    expect(records()).toEqual(before);
    expect(write).not.toHaveBeenCalled();
  });
});

describe('StatCard presentation and prop contract', () => {
  it.each([0, 12, '—', 'Available'])('renders named label/value %s and a decorative Phosphor icon', value => {
    expect(NamedStatCard).toBe(StatCard);
    const view = render(<StatCard label="Total Posts" value={value} icon={<Article size={24} />} />);
    expect(view.container.querySelector('dt').textContent).toBe('Total Posts');
    expect(view.container.querySelector('dd').textContent).toBe(String(value));
    expect(view.container.querySelector('dd')).toHaveClass('tabular-nums');
    expect(view.container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });

  it.each([
    [undefined, undefined, 'Statistic', '—'], [null, null, 'Statistic', '—'],
    ['', '', 'Statistic', '—'], [' ', NaN, 'Statistic', '—'], ['Metric', Infinity, 'Metric', '—'],
    [42, {}, 'Statistic', '—'], ['Metric', false, 'Metric', '—'],
  ])('safely displays label %j and value %j', (label, value, expectedLabel, expectedValue) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(<StatCard label={label} value={value} icon={null} />);
    expect(view.container.querySelector('dt').textContent).toBe(expectedLabel);
    expect(view.container.querySelector('dd').textContent).toBe(expectedValue);
    expect(view.container.querySelector('svg')).not.toBeNull();
  });

  it('defaults missing props and an invalid icon without rendering raw objects', () => {
    const view = render(<StatCard />);
    expect(screen.getByText('Statistic')).toBeVisible();
    expect(screen.getByText('—')).toBeVisible();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    view.rerender(<StatCard icon={{ invalid: true }} />);
    expect(view.container.querySelector('svg')).not.toBeNull();
  });

  it('declares validation for the named label, value, and icon props', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    PropTypes.resetWarningCache();
    PropTypes.checkPropTypes(StatCard.propTypes, { label: {}, value: [], icon: 'not an element' }, 'prop', 'StatCard');
    expect(error).toHaveBeenCalledTimes(3);
    expect(Object.keys(StatCard.propTypes)).toEqual(['value', 'label', 'icon']);
  });
});
