// Names the release APK `taskplanner.apk` (instead of `app-release.apk`).
// Lives in a config plugin so it survives `npx expo prebuild --clean`, which regenerates android/.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// @generated with-apk-name';

const SNIPPET = `
${MARKER}
android {
    applicationVariants.all { variant ->
        variant.outputs.all { output ->
            if (variant.buildType.name == "release") {
                outputFileName = "taskplanner.apk"
            }
        }
    }
}
`;

module.exports = function withApkName(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};
