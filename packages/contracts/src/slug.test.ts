import { describe, expect, it } from 'vitest';
import { SLUG_MAX_LENGTH, SLUG_PATTERN, slugSchema } from './common.js';
import { slugify } from './slug.js';

describe('slugify', () => {
  it.each([
    ['Настройка DNS в Windows Server 2022', 'nastroyka-dns-v-windows-server-2022'],
    ['Диагностика DHCP: шаг за шагом', 'diagnostika-dhcp-shag-za-shagom'],
    ['Щётка, ёлка и объём', 'shchetka-elka-i-obem'],
    ['  --nginx -t  ', 'nginx-t'],
    ['C# и .NET 8', 'c-i-net-8'],
    ['Café', 'cafe'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('always produces a value accepted by slugSchema (when non-empty)', () => {
    for (const s of ['Привет мир', 'A/B testing — 101', 'IPv6: ::1']) {
      const slug = slugify(s);
      expect(slug).toMatch(SLUG_PATTERN);
      expect(slugSchema.safeParse(slug).success).toBe(true);
    }
  });

  it('respects the maximum length without a trailing hyphen', () => {
    const slug = slugify('очень длинное название '.repeat(30));
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });
});
