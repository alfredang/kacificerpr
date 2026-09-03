export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type Params<T extends Record<string, string>> = Promise<T>;
export function sp(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
