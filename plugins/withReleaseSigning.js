const { withAppBuildGradle } = require('@expo/config-plugins');

const signingScript =
  '// LERONA_RELEASE_SIGNING\napply from: new File(rootDir, "../plugins/release-signing.gradle")\n';

function applyReleaseSigning(contents) {
  if (contents.includes('// LERONA_RELEASE_SIGNING')) return contents;
  return `${contents.trimEnd()}\n\n${signingScript}`;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy')
      throw new Error('withReleaseSigning requires a Groovy app build.gradle');
    mod.modResults.contents = applyReleaseSigning(mod.modResults.contents);
    return mod;
  });
};

module.exports.applyReleaseSigning = applyReleaseSigning;
