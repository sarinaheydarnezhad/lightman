import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const filename = join(directory, item.name);
    return item.isDirectory() ? sourceFiles(filename) : /\.tsx?$/.test(item.name) ? [filename] : [];
  });
}

test('domain and application stay independent of platform and adapters; presentation never imports data adapters', () => {
  const source = join(__dirname, '..', 'src');
  const features = join(source, 'features');
  const domains = [
    ...sourceFiles(features).filter((file) => file.includes(`${sep}domain${sep}`)),
    ...sourceFiles(join(source, 'core', 'domain')),
  ].filter((file) => !file.endsWith('.test.ts'));
  const presentations = sourceFiles(features).filter((file) =>
    file.includes(`${sep}presentation${sep}`),
  );
  const application = sourceFiles(join(source, 'core', 'application')).filter(
    (file) => !file.endsWith('.test.ts'),
  );
  for (const file of [...domains, ...application]) {
    const imports = readFileSync(file, 'utf8');
    expect(imports).not.toMatch(
      /from ['"][^'"]*(react-native|expo|zustand|\/data\/|\/composition\/)/,
    );
  }
  for (const file of presentations) {
    expect(readFileSync(file, 'utf8')).not.toMatch(/from ['"][^'"]*\/data\//);
  }
});
