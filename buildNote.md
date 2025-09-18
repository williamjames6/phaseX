1. Command to bundle for ios from CLI in IDE:
 <<
 npx react-native bundle \
  --entry-file index.js \
  --platform ios \
  --dev false \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios
 >>   

 2. "Build" in Xcode with desired iOS device selected
 

 P.S. In terminal, run "git log --oneline --graph --decorate --all" to visualize branching structure of project