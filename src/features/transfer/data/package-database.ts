export type PackageValue = string | number | Uint8Array | null;

export interface PackageDatabase {
  run(sql: string, parameters?: PackageValue[]): unknown;
  exec(sql: string): { columns: string[]; values: PackageValue[][] }[];
  export(): Uint8Array;
  close(): void;
}
