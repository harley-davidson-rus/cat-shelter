export function sentenceCase(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('ru');
  if (!normalized) return '';

  return normalized[0].toLocaleUpperCase('ru') + normalized.slice(1);
}
