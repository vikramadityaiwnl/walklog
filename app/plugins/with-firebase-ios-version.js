const { withPodfile, withXcodeProject } = require("expo/config-plugins");

module.exports = function withFirebaseIOSVersion(config) {
  config = withPodfile(config, (config) => {
    const line =
      "ENV['FIREBASE_SDK_VERSION'] = '12.19.0' # Hybrid AI requires the Firebase 12 API";
    if (!config.modResults.contents.includes(line))
      config.modResults.contents = `${line}\n${config.modResults.contents}`;
    return config;
  });

  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const objects = project.hash.project.objects;
    const packages = (objects.XCRemoteSwiftPackageReference ||= {});
    const url = "https://github.com/google/app-check.git";
    let id = Object.keys(packages).find(
      (key) =>
        !key.endsWith("_comment") &&
        String(packages[key].repositoryURL).replace(/"/g, "") === url,
    );
    if (!id) {
      id = project.generateUuid();
      packages[id] = {
        isa: "XCRemoteSwiftPackageReference",
        repositoryURL: `"${url}"`,
        requirement: { kind: "exactVersion", version: "11.3.1" },
      };
      packages[`${id}_comment`] = 'XCRemoteSwiftPackageReference "app-check"';
      const root = project.getFirstProject().firstProject;
      root.packageReferences ||= [];
      root.packageReferences.push({
        value: id,
        comment: 'XCRemoteSwiftPackageReference "app-check"',
      });
    }
    return config;
  });
};
