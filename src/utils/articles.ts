import { ShelterArticle } from '../types';

const publishedAtTimestamp = (publishedAt: string): number => {
  const match = publishedAt.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return Date.UTC(Number(year), Number(month) - 1, Number(day));
  }

  const timestamp = Date.parse(publishedAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const sortArticlesNewestFirst = (articles: ShelterArticle[]): ShelterArticle[] =>
  [...articles].sort(
    (left, right) => publishedAtTimestamp(right.publishedAt) - publishedAtTimestamp(left.publishedAt),
  );
