import { describe, expect, it } from 'vitest';
import { formatDate, parsePage, plural } from './utils';

describe('plural', () => {
  it.each([
    [1, 'минута'],
    [2, 'минуты'],
    [5, 'минут'],
    [11, 'минут'],
    [21, 'минута'],
    [22, 'минуты'],
    [112, 'минут'],
  ])('%i → %s', (n, form) => {
    expect(plural(n, ['минута', 'минуты', 'минут'])).toBe(form);
  });
});

describe('parsePage', () => {
  it.each([
    [undefined, 1],
    ['3', 3],
    [['4', '5'], 4],
    ['0', 1],
    ['-2', 1],
    ['1.5', 1],
    ['abc', 1],
    ['99999999', 1],
  ])('%s → %i', (input, expected) => {
    expect(parsePage(input)).toBe(expected);
  });
});

describe('formatDate', () => {
  it('shows UTC timestamps in Moscow time', () => {
    // 22:30 UTC on Nov 8 is already Nov 9 in Moscow (UTC+3).
    expect(formatDate('2026-11-08T22:30:00.000Z')).toBe('9 ноября 2026 г.');
  });
});
