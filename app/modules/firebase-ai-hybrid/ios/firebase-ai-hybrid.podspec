Pod::Spec.new do |s|
  s.name = 'firebase-ai-hybrid'
  s.version = '1.0.0'
  s.summary = 'Firebase AI Logic hybrid inference'
  s.description = 'Firebase AI Logic hybrid inference for Expo'
  s.author = 'walklog'
  s.homepage = 'https://firebase.google.com/docs/ai-logic/hybrid'
  s.platforms = { :ios => '16.4' }
  s.source = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  spm_dependency(s, url: 'https://github.com/firebase/firebase-ios-sdk', requirement: { kind: 'upToNextMajorVersion', minimumVersion: '12.19.0' }, products: ['FirebaseAILogic', 'FirebaseCore'])
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
