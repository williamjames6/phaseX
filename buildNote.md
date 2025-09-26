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
 

**Assorted notes** 
- In terminal, run "git log --oneline --graph --decorate --all" to visualize branching structure of project
- log of folder location using { File, Paths} from expo-file-system: "{"exists": true, "size": 39, "uri": "file:///Users/willreilly/Library/Developer/CoreSimulator/Devices/B9460640-955D-4D5E-8BD8-003349F2B694/data/Containers/Data/Application/17BD4540-8E03-4867-8EC3-0520AA9BA97E/Library/Caches/ExponentExperienceData/@anonymous/phaseX-9d93b947-0552-4e7b-97fa-b5602f34e94b/"}"