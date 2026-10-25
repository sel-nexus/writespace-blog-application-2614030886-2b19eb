/** Exercise real discovery components, router activation and local projections. */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import PublicNavbar from '../src/components/PublicNavbar';
import Avatar, { getAvatar } from '../src/components/Avatar';
import { excerpt, formatDate, newestFirst } from '../src/utils/ui';

/**
 * Create a complete deterministic local post.
 * Args:
 *   id (string): Identity and title suffix.
 *   day (number): January day used to determine recency.
 * Returns:
 *   Object: A valid demo publication record.
 */
function post(id, day) {
  return {
    id, title: `Story ${id}`, content: 'A'.repeat(140),
    createdAt: `2026-01-${String(day).padStart(2, '0')}T12:00:00.000Z`,
    authorId: 'demo-writer', authorName: 'Demo Writer',
  };
}

/**
 * Mount the actual application under a controllable memory router.
 * Args:
 *   path (string): Initial discovery or fallback location.
 * Returns:
 *   Object: Testing Library render result.
 */
function mount(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

/**
 * Build a valid demo session without credentials.
 * Args:
 *   role (string): Demo role for navigation.
 * Returns:
 *   Object: Complete session shape.
 */
function session(role) {
  return { userId: 'demo-id', username: 'demo', displayName: 'Demo Writer', role };
}

describe('public discovery', () => {
  it('renders exact tagline, three features, empty state, footer and truthful demo notice', () => {
    const setter = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
    expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
    for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast']) {
      expect(screen.getByRole('heading', { name })).toBeVisible();
    }
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
    const notice = screen.getByRole('complementary', { name: 'Local demo limitations' });
    expect(notice).toHaveTextContent('plaintext credentials');
    expect(notice).toHaveTextContent('Client-side roles are editable');
    expect(notice).toHaveTextContent('sensitive data');
    expect(notice).toHaveTextContent('no server, synchronization or backup');
    const footer = screen.getByRole('navigation', { name: 'Footer navigation' });
    for (const [name, href] of [['Home', '/'], ['All Blogs', '/blogs'], ['Login', '/login'], ['Register', '/register']]) {
      expect(within(footer).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    expect(setter).not.toHaveBeenCalled();
  });

  it.each([
    ['Start Reading', '/login'], ['Get Started Free', '/register'],
  ])('navigates %s only after activation and returns through the public logo', async (name, href) => {
    const user = userEvent.setup();
    mount();
    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('href', href);
    expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument();
    await user.click(link);
    expect(screen.getByRole('textbox', { name: 'Username' })).toBeVisible();
    await user.click(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'WriteSpace' }));
    expect(screen.getByRole('heading', { name: 'WriteSpace' })).toBeVisible();
  });

  it('opens and closes the mobile menu and activates Login and Get Started', async () => {
    const user = userEvent.setup();
    mount();
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(toggle.getAttribute('aria-controls'))).toHaveClass('hidden');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    const nav = screen.getByRole('navigation', { name: 'Public navigation' });
    await user.click(within(nav).getByRole('link', { name: 'Login' }));
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(within(nav).getByRole('link', { name: 'WriteSpace' }));
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(within(nav).getByRole('link', { name: 'Get Started' }));
    expect(screen.getByRole('textbox', { name: 'Display name' })).toBeVisible();
  });

  it.each(['admin', 'user'])('uses %s dashboard and signed-in reading destinations', async role => {
    const identity = session(role);
    localStorage.setItem('writespace_session', JSON.stringify(identity));
    const user = userEvent.setup();
    mount();
    const nav = screen.getByRole('navigation', { name: 'Public navigation' });
    expect(within(nav).getByText(identity.displayName)).toBeVisible();
    expect(within(nav).getByRole('img', { name: role === 'admin' ? 'Admin avatar' : 'User avatar' })).toBeVisible();
    expect(within(nav).queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
    const dashboard = within(nav).getByRole('link', { name: 'Go to Dashboard' });
    expect(dashboard).toHaveAttribute('href', role === 'admin' ? '/admin' : '/blogs');
    await user.click(dashboard);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(identity);
    localStorage.removeItem('writespace_session');
    await user.click(screen.getByRole('link', { name: 'Back to Home' }));
    expect(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'Login' })).toBeVisible();
  });

  it.each([
    '{broken', 'null', '[]', '{}', '{"role":"admin"}',
    JSON.stringify({ ...session('user'), role: 'owner' }),
    JSON.stringify({ ...session('user'), userId: 42 }),
    JSON.stringify({ ...session('user'), displayName: ' ' }),
    JSON.stringify({ ...session('user'), username: null }),
  ])('treats invalid session %s as guest without repairing it', raw => {
    localStorage.setItem('writespace_session', raw);
    mount();
    expect(screen.getByRole('link', { name: 'Get Started Free' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Go to Dashboard' })).not.toBeInTheDocument();
    expect(localStorage.getItem('writespace_session')).toBe(raw);
  });

  it.each(['{broken', '{}', '[null,42,{},"bad",{"id":"partial"}]'])(
    'renders the exact empty state for unusable posts %s without overwrite', raw => {
      localStorage.setItem('writespace_posts', raw);
      const setter = vi.spyOn(Storage.prototype, 'setItem');
      mount();
      expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
      expect(localStorage.getItem('writespace_posts')).toBe(raw);
      expect(setter).not.toHaveBeenCalled();
    },
  );

  it('renders a guest empty state when storage access is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    mount();
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Get Started Free' })).toBeVisible();
  });

  it('limits valid previews to three, preserves tie order, escapes text and activates the newest preview', async () => {
    const rows = [post('old', 1), null, post('newest', 20), post('tie', 20), post('middle', 10), { ...post('bad', 30), content: {} }];
    rows[2].title = '<script>not executable</script>';
    const raw = JSON.stringify(rows);
    localStorage.setItem('writespace_posts', raw);
    const user = userEvent.setup();
    mount();
    const latest = screen.getByRole('region', { name: 'Latest from the Blog' });
    expect(within(latest).getAllByRole('heading', { level: 3 }).map(node => node.textContent)).toEqual([
      '<script>not executable</script>', 'Story tie', 'Story middle',
    ]);
    expect(within(latest).getAllByRole('link')).toHaveLength(3);
    expect(within(latest).getAllByText('A'.repeat(120))).toHaveLength(3);
    expect(within(latest).getAllByText('Jan 20, 2026')).toHaveLength(2);
    expect(document.querySelector('script')).toBeNull();
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    const preview = within(latest).getAllByRole('link')[0];
    expect(preview).toHaveAttribute('href', '/blog/newest');
    await user.click(preview);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  it('renders a single real post without invented additional previews', () => {
    localStorage.setItem('writespace_posts', JSON.stringify([post('only', 1)]));
    mount();
    expect(within(screen.getByRole('region', { name: 'Latest from the Blog' })).getAllByRole('link')).toHaveLength(1);
  });

  it('accepts a missing or explicit null public navbar session', () => {
    const view = render(<MemoryRouter><PublicNavbar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Login' })).toBeVisible();
    view.rerender(<MemoryRouter><PublicNavbar session={null} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Get Started' })).toBeVisible();
  });

  it('renders both the component and JSX-returning avatar export as SVG role cues', () => {
    render(<div><Avatar role="admin" />{getAvatar('user')}</div>);
    expect(screen.getByRole('img', { name: 'Admin avatar' })).toHaveClass('bg-violet-600');
    expect(screen.getByRole('img', { name: 'User avatar' })).toHaveClass('bg-indigo-500');
    expect(document.querySelectorAll('svg')).toHaveLength(2);
  });

  it('uses a safe fallback for unmatched paths', async () => {
    mount('/unknown/nested');
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to Home' }));
    expect(screen.getByRole('heading', { name: 'WriteSpace' })).toBeVisible();
  });
});

describe('publication projection boundary', () => {
  it('filters malformed rows before stable copied sorting', () => {
    const rows = [post('old', 1), post('tie-first', 20), post('tie-second', 20)];
    const snapshot = [...rows];
    const dirty = [null, 5, 'text', [], {}, ...rows, { ...post('bad-date', 30), createdAt: 'invalid' }];
    expect(newestFirst(dirty).map(row => row.id)).toEqual(['tie-first', 'tie-second', 'old']);
    expect(rows).toEqual(snapshot);
    expect(newestFirst(rows)).not.toBe(rows);
    expect(newestFirst(null)).toEqual([]);
  });

  it('formats and excerpts defensively within the character budget', () => {
    expect(formatDate('2026-01-01T23:00:00.000Z')).toBe('Jan 01, 2026');
    for (const invalid of [null, 42, {}, 'invalid']) expect(formatDate(invalid)).toBe('Date unavailable');
    expect(excerpt('x'.repeat(200))).toHaveLength(120);
    expect(excerpt('short')).toBe('short');
    expect(excerpt(null)).toBe('');
    expect(excerpt('short', 0)).toBe('');
    expect(excerpt('x'.repeat(200), -1)).toHaveLength(120);
  });
});
