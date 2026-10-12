type SeoEntity = { id: string };

const transliteration: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function seoSlug(value: string, fallback = 'material'): string {
  const normalized = value
    .trim()
    .toLocaleLowerCase('ru-RU')
    .split('')
    .map((character) => transliteration[character] ?? character)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '');

  return normalized || fallback;
}

function stableSuffix(id: string): string {
  const readable = id.toLocaleLowerCase().replace(/[^a-z0-9]/g, '').slice(-8);
  if (readable.length >= 4) return readable;

  let hash = 2166136261;
  for (const character of id) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function uniqueSeoSlug<T extends SeoEntity>(
  item: T,
  allItems: T[],
  getTitle: (candidate: T) => string,
  fallback: string,
): string {
  const base = seoSlug(getTitle(item), fallback);
  const duplicates = allItems
    .filter((candidate) => seoSlug(getTitle(candidate), fallback) === base)
    .sort((left, right) => left.id.localeCompare(right.id));

  if (duplicates.length < 2 || duplicates[0]?.id === item.id) return base;
  return base + '-' + stableSuffix(item.id);
}

export function findBySeoSlug<T extends SeoEntity>(
  slug: string,
  items: T[],
  getTitle: (candidate: T) => string,
  fallback: string,
): T | undefined {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // Keep the original value when a malformed URL reaches the client.
  }
  return items.find((item) => uniqueSeoSlug(item, items, getTitle, fallback) === decoded);
}

export function catSeoPath<T extends SeoEntity & { name: string }>(cat: T, cats: T[]): string {
  return '/cats/' + uniqueSeoSlug(cat, cats, (candidate) => candidate.name, 'kotik');
}

export function articleSeoPath<T extends SeoEntity & { title: string }>(article: T, articles: T[]): string {
  return '/news/' + uniqueSeoSlug(article, articles, (candidate) => candidate.title, 'novost');
}

export function normalizeArticleTag(value: string): string {
  return value.trim().replace(/^#+\s*/, '').replace(/\s+/g, ' ');
}

export function articleTagSlug(tag: string): string {
  return seoSlug(normalizeArticleTag(tag), 'tema');
}

export function articleTagPath(tag: string): string {
  return '/news/tag/' + articleTagSlug(tag);
}

export function findArticleTagBySlug<T extends { tags: string[] }>(slug: string, articles: T[]): string | undefined {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // Keep the original value when a malformed URL reaches the client.
  }

  const tags = articles
    .flatMap((article) => article.tags || [])
    .map(normalizeArticleTag)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'ru'));

  return tags.find((tag) => articleTagSlug(tag) === decoded);
}
