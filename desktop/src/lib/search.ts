export function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd');
}

export function matchesSearch(value: string, query: string): boolean {
  return normalizeSearch(value).includes(normalizeSearch(query));
}
