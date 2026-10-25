/** Exercise every UI helper across valid, negative, and malformed input branches. */
import { describe, expect, it } from 'vitest';
import {
  buttonStyles, dashboardHref, excerpt, focusRing, formatDate, headingFont,
  isPost, isSession, newestFirst, postAccents, sessionPropShape,
} from '../src/utils/ui';

const validPost = {
  id: 'p1', title: 'First story', content: 'Line one\nLine two',
  createdAt: '2026-01-15T12:00:00.000Z', authorId: 'u1', authorName: 'Mina',
};
const validSession = { userId: 'u1', username: 'mina', displayName: 'Mina', role: 'user' };
const invalidText = [undefined, null, false, 42, {}, [], '', ' \n\t'];
const invalidContainers = [undefined, null, false, 42, 'text', [], () => {}];

describe('isPost', () => {
  it('accepts complete text records including literal HTML and extra fields', () => {
    expect(isPost(validPost)).toBe(true);
    expect(isPost({ ...validPost, title: '<script>text</script>', content: '<img onerror=alert(1)>', extra: true })).toBe(true);
  });
  it.each(invalidContainers.map(value => [value]))('rejects non-record input %s', value => {
    expect(isPost(value)).toBe(false);
  });
  for (const field of Object.keys(validPost)) {
    it.each(invalidText.map(value => [value]))(`rejects unusable ${field} %s`, value => {
      expect(isPost({ ...validPost, [field]: value })).toBe(false);
    });
    it(`rejects absent ${field}`, () => {
      const row = { ...validPost };
      delete row[field];
      expect(isPost(row)).toBe(false);
    });
  }
  it('rejects invalid dates after passing every text field check', () => {
    expect(isPost({ ...validPost, createdAt: 'not a date' })).toBe(false);
  });
});

describe('newestFirst', () => {
  it.each(invalidContainers.map(value => [value]))('returns an empty projection for %s', value => {
    expect(newestFirst(value)).toEqual([]);
  });
  it('handles zero, one, invalid-only and mixed records without modifying frozen input', () => {
    expect(newestFirst([])).toEqual([]);
    expect(newestFirst([null, {}, { ...validPost, content: 5 }])).toEqual([]);
    const one = Object.freeze([Object.freeze({ ...validPost })]);
    expect(newestFirst(one)).toEqual(one);
    expect(newestFirst(one)).not.toBe(one);
    const old = Object.freeze({ ...validPost, id: 'old', createdAt: '2025-12-31T00:00:00Z' });
    const newest = Object.freeze({ ...validPost, id: 'new', createdAt: '2026-02-01T00:00:00Z' });
    const tie = Object.freeze({ ...newest, id: 'tie', createdAt: '2026-01-31T19:00:00-05:00' });
    const rows = Object.freeze([old, null, newest, {}, tie, validPost]);
    const snapshot = JSON.stringify(rows);
    expect(newestFirst(rows)).toEqual([newest, tie, validPost, old]);
    expect(newestFirst(rows)[0]).toBe(newest);
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
});

describe('formatDate', () => {
  it.each([
    ['2026-01-01T00:00:00Z', 'Jan 01, 2026'],
    ['2026-01-01T23:30:00-02:00', 'Jan 02, 2026'],
    ['2026-01-01T01:00:00+02:00', 'Dec 31, 2025'],
    ['2024-02-29T12:00:00Z', 'Feb 29, 2024'],
  ])('formats %s in UTC with an English two-digit day', (input, expected) => {
    expect(formatDate(input)).toBe(expected);
  });
  it.each([...invalidContainers, {}, '', ' ', 'invalid', new Date()].map(value => [value]))(
    'returns an unavailable label for %s', value => {
      expect(formatDate(value)).toBe('Date unavailable');
    },
  );
});

describe('excerpt', () => {
  it.each([0, 1, 119, 120, 121, 250])('bounds a %s-character body without ellipsis', length => {
    expect(excerpt('x'.repeat(length))).toBe('x'.repeat(Math.min(length, 120)));
  });
  it('preserves whitespace and HTML as plain text and supports explicit integer budgets', () => {
    const text = '<script>text</script>\n  second line';
    expect(excerpt(text)).toBe(text);
    for (const limit of [0, 1, 7, 120, 200]) expect(excerpt(text, limit)).toBe(text.slice(0, limit));
  });
  it.each([undefined, null, false, 4, {}, [], () => {}].map(value => [value]))(
    'returns empty text for non-string %s', value => expect(excerpt(value)).toBe(''),
  );
  it.each([-1, 1.5, NaN, Infinity, -Infinity, null, true, '3', {}, []].map(value => [value]))(
    'uses the default budget for invalid limit %s', value => {
      expect(excerpt('x'.repeat(200), value)).toBe('x'.repeat(120));
    },
  );
});

describe('session helpers', () => {
  it.each(['user', 'admin'])('accepts a complete %s identity', role => {
    expect(isSession({ ...validSession, role, extra: 'ignored' })).toBe(true);
    expect(dashboardHref({ ...validSession, role })).toBe(role === 'admin' ? '/admin' : '/blogs');
  });
  it.each(invalidContainers.map(value => [value]))('rejects non-record session %s', value => {
    expect(isSession(value)).toBe(false);
  });
  for (const field of sessionPropShape.fields) {
    it.each(invalidText.map(value => [value]))(`rejects invalid session ${field} %s`, value => {
      expect(isSession({ ...validSession, [field]: value })).toBe(false);
    });
    it(`rejects missing session ${field}`, () => {
      const row = { ...validSession };
      delete row[field];
      expect(isSession(row)).toBe(false);
    });
  }
  it.each([...invalidText, 'owner', 'Admin'].map(value => [value]))('rejects unsupported role %s', role => {
    expect(isSession({ ...validSession, role })).toBe(false);
  });
  it.each([undefined, null, {}, { role: 'user' }, { role: 'owner' }, 42, 'admin'].map(value => [value]))(
    'defaults dashboard destination for %s', value => expect(dashboardHref(value)).toBe('/blogs'),
  );
});

describe('shared presentation roles', () => {
  it('provides visible focus, minimum action targets, serif headings and four distinct accents', () => {
    expect(focusRing).toContain('focus-visible:ring-2');
    expect(headingFont).toContain('Georgia');
    expect(postAccents).toEqual(['border-indigo-500', 'border-violet-500', 'border-pink-500', 'border-teal-500']);
    expect(sessionPropShape).toEqual({ fields: ['userId', 'username', 'displayName'], roles: ['admin', 'user'] });
    expect(Object.keys(buttonStyles)).toEqual(['primary', 'secondary', 'ghost', 'destructive']);
    for (const style of Object.values(buttonStyles)) {
      expect(style).toContain(focusRing);
      expect(style).toContain('min-h-11');
      expect(style).not.toContain('transition-all');
    }
    expect(buttonStyles.primary).toContain('bg-indigo-600');
    expect(buttonStyles.secondary).toContain('bg-white');
    expect(buttonStyles.ghost).toContain('text-slate-600');
    expect(buttonStyles.destructive).toContain('text-red-700');
  });
});
