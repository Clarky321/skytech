/** Public URL policy (ADR 0001). Build every public link through these helpers. */
export const urls = {
  home: () => '/',
  articles: (page = 1) => (page > 1 ? `/articles?page=${page}` : '/articles'),
  article: (slug: string) => `/articles/${slug}`,
  page: (slug: string) => `/${slug}`,
  category: (path: readonly string[]) => `/category/${path.join('/')}`,
  tag: (slug: string) => `/tags/${slug}`,
  author: (slug: string) => `/authors/${slug}`,
  tool: (slug: string) => `/tools/${slug}`,
  search: () => '/search',
  rss: () => '/rss.xml',
} as const;
