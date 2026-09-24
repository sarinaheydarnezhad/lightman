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
  const application = [
    ...sourceFiles(join(source, 'core', 'application')),
    ...sourceFiles(features).filter((file) => file.includes(`${sep}application${sep}`)),
  ].filter((file) => !file.endsWith('.test.ts'));
  for (const file of [...domains, ...application]) {
    const imports = readFileSync(file, 'utf8');
    expect(imports).not.toMatch(
      /from ['"][^'"]*(react-native|expo|zustand|\/data\/|\/composition\/)/,
    );
  }
  for (const file of presentations) {
    expect(readFileSync(file, 'utf8')).not.toMatch(/from ['"][^'"]*\/data\//);
    expect(readFileSync(file, 'utf8')).not.toMatch(
      /from ['"][^'"]*(leitner-srs|review-repository|study-session-workflow)/,
    );
  }
});

test('SRS scheduling module has no device clock, random, network, or file side effects', () => {
  const engine = readFileSync(
    join(__dirname, '..', 'src', 'features', 'study', 'domain', 'leitner-srs.ts'),
    'utf8',
  );
  expect(engine).not.toMatch(/\b(?:Date\.now|Math\.random|fetch|XMLHttpRequest)\s*\(/);
  expect(engine).not.toMatch(/\b(?:new Date|require\s*\()/);
  expect(engine).not.toMatch(
    /from ['"][^'"]*(node:fs|node:http|react-native|expo|zustand|\/data\/)/,
  );
});
