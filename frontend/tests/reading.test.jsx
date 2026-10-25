/** Verify real reading routes, safe projections, author roles, and read-only rendering. */
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import BlogCard, { authorRole, canEditPost } from '../src/components/BlogCard';
import { DEFAULT_ADMIN } from '../src/utils/accountEntry';
import { postAccents } from '../src/utils/ui';

const regular = { userId: 'u1', username: 'mina', displayName: 'Mina', role: 'user' };

/** Build a complete deterministic post with optional field overrides. */
function post(id = 'p1', day = 15, overrides = {}) {
  return {
    id, title: `Story ${id}`, content: 'A'.repeat(150), authorId: 'u1', authorName: 'Mina',
    createdAt: `2026-01-${String(day).padStart(2, '0')}T12:00:00.000Z`, ...overrides,
  };
}

/** Seed exact local records before spying on render-time mutations. */
function seed(posts = [], session = regular, users = []) {
  localStorage.setItem('writespace_posts', JSON.stringify(posts));
  localStorage.setItem('writespace_users', JSON.stringify(users));
  if (session) localStorage.setItem('writespace_session', JSON.stringify(session));
}

/** Mount the real route shell in StrictMode at the requested initial entry. */
function mount(path = '/blogs') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}><App /></MemoryRouter>
    </StrictMode>,
  );
}

/** Mount a card alone to exercise malformed records and preview mode directly. */
function card(props = {}) {
  return render(<MemoryRouter><BlogCard {...props} /></MemoryRouter>);
}

describe('reading collection', () => {
  it.each([[], [null, false, 42, 'text', [], {}, { id: 'partial' }]].map(rows => [rows]))(
    'renders the exact empty collection for %j with a write destination', rows => {
      seed(rows);
      mount();
      expect(screen.getByRole('heading', { level: 1, name: 'All Blogs' })).toBeVisible();
      expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Write a Blog' })).toHaveAttribute('href', '/write');
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    },
  );
  it.each(['{broken', 'null', '{}', '42'])('does not repair unusable raw posts %s', raw => {
    seed();
    localStorage.setItem('writespace_posts', raw);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    expect(write).not.toHaveBeenCalled();
  });
  it('renders one real post, attribution, bounded excerpt, UTC date, and responsive grid', () => {
    seed([post('only', 1, { createdAt: '2026-01-01T23:30:00-02:00' })]);
    mount();
    const collection = screen.getByRole('region', { name: 'Blog collection' });
    expect(collection).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
    expect(within(collection).getAllByRole('article')).toHaveLength(1);
    expect(within(collection).getByRole('heading', { level: 2 })).toHaveTextContent('Story only');
    expect(within(collection).getByText('A'.repeat(120))).toBeVisible();
    expect(within(collection).getByText('Mina')).toBeVisible();
    expect(within(collection).getByRole('img', { name: 'User avatar' })).toBeVisible();
    expect(within(collection).getByText('Jan 02, 2026')).toHaveAttribute('datetime', '2026-01-01T23:30:00-02:00');
  });
  it('filters malformed rows, preserves ties, shows every valid post and cycles accents twice', () => {
    const posts = [post('old', 1), null, post('new', 30), post('tie', 30), {},
      post('six', 6), post('five', 5), post('four', 4), post('three', 3), post('two', 2),
      post('bad', 31, { content: {} }), post('bad-date', 31, { createdAt: 'invalid' })];
    seed(posts);
    const raw = localStorage.getItem('writespace_posts');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    const articles = within(screen.getByRole('region', { name: 'Blog collection' })).getAllByRole('article');
    expect(articles.map(node => within(node).getByRole('heading').textContent)).toEqual([
      'Story new', 'Story tie', 'Story six', 'Story five', 'Story four', 'Story three', 'Story two', 'Story old',
    ]);
    articles.forEach((node, index) => expect(node).toHaveClass(postAccents[index % 4]));
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    expect(write).not.toHaveBeenCalled();
  });
  it('opens a real detail through its card and returns by the back link without storage writes', async () => {
    const body = 'First line\n\n  Indented second line\n' + 'Full text beyond the preview. '.repeat(10);
    seed([post('read me', 15, { content: body })]);
    const raw = localStorage.getItem('writespace_posts');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const clear = vi.spyOn(Storage.prototype, 'clear');
    const actor = userEvent.setup();
    mount();
    const link = within(screen.getByRole('article')).getByRole('link', { name: /Read post/ });
    expect(link).toHaveAttribute('href', '/blog/read%20me');
    await actor.click(link);
    expect(screen.getByRole('heading', { level: 1, name: 'Story read me' })).toBeVisible();
    const content = document.querySelector('.whitespace-pre-wrap');
    expect(content.textContent).toBe(body);
    expect(content).toHaveClass('break-words');
    await actor.click(screen.getByRole('link', { name: 'Back to All Blogs' }));
    expect(screen.getByRole('heading', { level: 1, name: 'All Blogs' })).toBeVisible();
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });
});

describe('BlogCard defensive presentation', () => {
  it.each([undefined, null, false, 42, 'text', [], {}, post('bad', 1, { content: null })].map(value => [value]))(
    'renders nothing for malformed post %s without console errors', value => {
      const error = vi.spyOn(console, 'error');
      const view = card({ post: value });
      expect(view.container).toBeEmptyDOMElement();
      expect(error).not.toHaveBeenCalled();
    },
  );
  it.each([119, 120, 121])('renders exactly the bounded %s-character excerpt', length => {
    card({ post: post('boundary', 1, { content: 'x'.repeat(length) }) });
    expect(screen.getByText('x'.repeat(Math.min(length, 120)))).toBeVisible();
    expect(screen.queryByText('x'.repeat(120) + '…')).not.toBeInTheDocument();
  });
  it.each([-1, 1.5, NaN, Infinity])('falls back to the first accent for invalid index %s', index => {
    card({ post: post(), index });
    expect(screen.getByRole('article')).toHaveClass(postAccents[0]);
  });
  it('uses the default index, and preview mode prevents authorized edits with level-three headings', () => {
    card({ post: post(), session: DEFAULT_ADMIN, preview: true });
    expect(screen.getByRole('article')).toHaveClass(postAccents[0]);
    expect(screen.getByRole('heading', { level: 3, name: 'Story p1' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });
  it.each([DEFAULT_ADMIN, regular])('never exposes edit controls in real landing previews for %j', session => {
    seed([post()], session);
    mount('/');
    const latest = screen.getByRole('region', { name: 'Latest from the Blog' });
    expect(within(latest).getByRole('heading', { level: 3, name: 'Story p1' })).toBeVisible();
    expect(within(latest).getAllByRole('link')).toHaveLength(1);
    expect(within(latest).queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });
});

describe('author roles and edit presentation', () => {
  it.each([
    [DEFAULT_ADMIN.userId, [], 'Admin avatar'],
    ['stored-admin', [null, 42, [], { id: 'stored-admin', role: 'admin', password: 'do-not-render' }], 'Admin avatar'],
    ['u1', [{ id: 'u1', role: 'user' }], 'User avatar'],
    ['u1', [{ id: 'u1', role: 'owner' }], 'User avatar'],
    ['unknown', [], 'User avatar'],
  ])('resolves author %s independently of the viewing actor', (authorId, users, label) => {
    seed([], null, users);
    card({ post: post('p1', 15, { authorId }), session: regular });
    expect(screen.getByRole('img', { name: label })).toBeVisible();
    expect(screen.queryByText('do-not-render')).not.toBeInTheDocument();
  });
  it('uses safe role fallback for corrupt or unavailable accounts and fixed Admin precedence', () => {
    localStorage.setItem('writespace_users', '{broken');
    expect(authorRole('unknown')).toBe('user');
    localStorage.setItem('writespace_users', JSON.stringify([{ id: DEFAULT_ADMIN.userId, role: 'user' }]));
    expect(authorRole(DEFAULT_ADMIN.userId)).toBe('admin');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    expect(authorRole('unknown')).toBe('user');
    expect(authorRole(DEFAULT_ADMIN.userId)).toBe('admin');
  });
  for (const path of ['/blogs', '/blog/p1']) {
    it.each([
      ['Admin any', DEFAULT_ADMIN, 'someone-else', true],
      ['owner', regular, 'u1', true],
      ['other', regular, 'someone-else', false],
    ])(`${path} shows edit only for %s`, (label, session, authorId, allowed) => {
      seed([post('p1', 15, { authorId })], session);
      mount(path);
      if (allowed) expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/edit/p1');
      else expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
      if (path === '/blog/p1' && allowed) {
        expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
      } else {
        expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('link', { name: /Delete/i })).not.toBeInTheDocument();
    });
  }
  it.each([null, {}, { ...regular, role: 'owner' }, { ...regular, userId: '' }])(
    'fails closed for unusable actor %j', session => {
      expect(canEditPost(post(), session)).toBe(false);
      card({ post: post(), session });
      expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    },
  );
  it('rejects malformed posts before ownership and encodes authorized edit IDs', () => {
    expect(canEditPost(null, DEFAULT_ADMIN)).toBe(false);
    card({ post: post('a/b ?'), session: regular });
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/edit/a%2Fb%20%3F');
  });
});

describe('real detail and guest routes', () => {
  it('renders title, author and complete multiline XSS-like content as literal text', () => {
    const title = '<script>window.hacked=true</script>';
    const body = '<img src=x onerror="alert(1)">\n\n  <script>alert(2)</script>\n' + 'z'.repeat(160);
    const name = '<svg onload=alert(3)>';
    seed([post('xss', 15, { title, content: body, authorName: name, authorId: DEFAULT_ADMIN.userId })]);
    mount('/blog/xss');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title);
    expect(screen.getByText(name)).toBeVisible();
    expect(within(screen.getByRole('article')).getByRole('img', { name: 'Admin avatar' })).toBeVisible();
    expect(screen.getByText('Jan 15, 2026')).toBeVisible();
    expect(document.querySelector('.whitespace-pre-wrap').textContent).toBe(body);
    expect(document.querySelector('script, img, svg[onload]')).toBeNull();
    expect(window.hacked).toBeUndefined();
  });
  it.each([[], [null, { id: 'missing' }], [post('different')], [post('missing', 15, { createdAt: 'invalid' })]].map(rows => [rows]))(
    'shows exact missing state for %j and returns through its back link', async rows => {
      seed(rows);
      mount('/blog/missing');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Post not found');
      expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
      const back = screen.getByRole('link', { name: 'Back to All Blogs' });
      expect(back).toHaveAttribute('href', '/blogs');
      await userEvent.setup().click(back);
      expect(screen.getByRole('heading', { level: 1, name: 'All Blogs' })).toBeVisible();
    },
  );
  it('skips a malformed duplicate to resolve the first valid exact-ID record', () => {
    seed([{ id: 'p1' }, post()]);
    mount('/blog/p1');
    expect(screen.getByRole('heading', { level: 1, name: 'Story p1' })).toBeVisible();
  });
  it.each(['/blogs', '/blog/p1', '/blog/missing'])('redirects guest %s to real login without reading protected content', path => {
    seed([post()], null);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    mount(path);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Story p1' })).not.toBeInTheDocument();
    expect(screen.queryByText('Post not found')).not.toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it('redirects activated guest previews to login without exposing full text', async () => {
    seed([post()], null);
    mount('/');
    const preview = within(screen.getByRole('region', { name: 'Latest from the Blog' })).getByRole('link');
    await userEvent.setup().click(preview);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(screen.queryByText('A'.repeat(150))).not.toBeInTheDocument();
  });
  it.each(['/blogs', '/blog/p1'])('treats a malformed stored session as guest on %s without repairing it', path => {
    seed([post()]);
    localStorage.setItem('writespace_session', '{broken');
    mount(path);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(localStorage.getItem('writespace_session')).toBe('{broken');
  });
});
