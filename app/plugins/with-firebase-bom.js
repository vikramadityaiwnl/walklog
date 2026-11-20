const { withProjectBuildGradle } = require("expo/config-plugins");

// Firebase BoM 35's Auth library requires Kotlin 2.4; Expo SDK 58 uses 2.2.
const firebaseBomVersion = "34.19.0";
const startMarker = "// WALKLOG_FIREBASE_BOM_OVERRIDE_START";
const endMarker = "// WALKLOG_FIREBASE_BOM_OVERRIDE_END";

module.exports = function withFirebaseBom(config) {
  return withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    const start = contents.indexOf(startMarker);
    const end = contents.indexOf(endMarker, start);
    const base =
      start >= 0 && end >= 0
        ? `${contents.slice(0, start)}${contents.slice(end + endMarker.length)}`
        : contents;

    config.modResults.contents = `${base.trimEnd()}
      ${startMarker}
      project.ext {
        set('react-native', [versions: [firebase: [bom: '${firebaseBomVersion}']]])
      }
      ${endMarker}
    `;

    return config;
  });
};
