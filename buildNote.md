**CURRENT BUILD STRATEGY**
1. Command to bundle for ios from CLI in IDE:
 <<
 npx react-native bundle \
  --entry-file index.js \
  --platform ios \
  --dev false \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios
 >>   

 2. Manually drag and drop "assets" folder and "main.jsbundle" into xcode "phaseX" project

 3. "Build" in Xcode with desired iOS device selected

 Potential issues:
 - Pods and Podfile.lock outdated, need to run "rm -rf Pods Podfile.lock" and then "pod install" to reload (roughly speaking, Cocoapods is to iOS what npm is to JS)
 

**Assorted notes** 
- In terminal, run "git log --oneline --graph --decorate --all" to visualize branching structure of project
- log of folder location using { File, Paths} from expo-file-system: "{"exists": true, "size": 39, "uri": "file:///Users/willreilly/Library/Developer/CoreSimulator/Devices/B9460640-955D-4D5E-8BD8-003349F2B694/data/Containers/Data/Application/17BD4540-8E03-4867-8EC3-0520AA9BA97E/Library/Caches/ExponentExperienceData/@anonymous/phaseX-9d93b947-0552-4e7b-97fa-b5602f34e94b/"}"

**Bugs from most recent iPhone build**
FIXED- Chat entry box size, typing off width of screen, slow response time, agent always responding with how to improve instead of just answering question.
FIXED- No faceID auto reentry (expected)
FIXED- Assets not loading? download icon + sketch icon not visible but still respond to touch. Possibly due to manually adding my "main.jsbundle" to Xcode?
FIXED- Download modal calendar extend beyond width of modal
- Physical backend network request failure (expected)
FIXED?- Session creation modal keybaord input only allows for numbers, problems when you change default date entry
- Splash screen shows up for ~15s when opening app on iPhone 
FIXED- Add superset button + keyboard sensitive scroll view on gym page
FIXED- Keyboard sensitive scrollview responsive to new line on. Anytime someone is typing, the typing line should be visible just above the keyboard
FIXED- Bug with timestamp because stored as strings, ":" messes with sequential order.


**Features to add**
IMPLEMENTED- Timestamp entry should be fixed by regex to [0-9]*:[0-9][0-9]. (expected)
IMPLEMENTED- "Note" option should be only text entry (NEED TO IMPLEMENT BACKEND OPERATION FOR NOTE ENTRY, ALTER VALUE SHOWN IN FRONT END OF JOURNALENTRY/INDEX)
IMPLEMENTED- Sketch functions (eraser, undo, color) (expected)
IMPLEMENTED- Time scroll for timestamp
IMPLEMENTED- Arrowhead direction + change dashed arrow + ball + straighten arrows
- Linking with [] and {} for timestamps and other dates
- Right now, nothing about the chat interaction persists across renders. Very short term --> should be more useful long term
- Timeout for router.replace("/") on appState going to background
- Forgot password flow + verify email flow