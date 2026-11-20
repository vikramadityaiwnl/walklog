const { withPodfile, withXcodeProject } = require("expo/config-plugins");

module.exports = function withFirebaseIOSVersion(config) {
  config = withPodfile(config, (config) => {
    const line =
      "ENV['FIREBASE_SDK_VERSION'] = '12.19.0' # Hybrid AI requires the Firebase 12 API";
    if (!config.modResults.contents.includes(line))
      config.modResults.contents = `${line}\n${config.modResults.contents}`;
    const googleSignInLink = `# Link Google Sign-In's Swift package to the app for Expo's static adapter.
post_integrate do |installer|
  installer.aggregate_targets.map(&:user_project).uniq.each do |project|
    target = project.native_targets.find { |candidate| candidate.name == 'walklog' }
    next unless target

    package = project.root_object.package_references.find do |candidate|
      candidate.respond_to?(:repositoryURL) && candidate.repositoryURL == 'https://github.com/google/GoogleSignIn-iOS'
    end
    unless package
      package = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
      package.repositoryURL = 'https://github.com/google/GoogleSignIn-iOS'
      package.requirement = { 'kind' => 'upToNextMajorVersion', 'minimumVersion' => '9.2.0' }
      project.root_object.package_references << package
    end

    product = target.package_product_dependencies.find { |dependency| dependency.product_name == 'GoogleSignIn' }
    unless product
      product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
      product.package = package
      product.product_name = 'GoogleSignIn'
      target.package_product_dependencies << product
    end

    unless target.frameworks_build_phase.files.any? { |file| file.product_ref == product }
      build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
      build_file.product_ref = product
      target.frameworks_build_phase.files << build_file
    end
    project.save
  end
end
`;
    if (
      !config.modResults.contents.includes(
        "# Link Google Sign-In's Swift package",
      )
    )
      config.modResults.contents += `\n${googleSignInLink}`;
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
