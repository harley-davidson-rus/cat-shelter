export function sentenceCase(value: string): string {
  const withoutEdgePunctuation = value
    .trim()
    .replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '');
  const normalized = withoutEdgePunctuation.toLocaleLowerCase('ru');
  if (!normalized) return '';

  return normalized[0].toLocaleUpperCase('ru') + normalized.slice(1);
}
