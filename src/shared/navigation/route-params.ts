export function routeParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}
