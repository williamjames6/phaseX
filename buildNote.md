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

**Bugs from most recent iPhone build**
FIXED- Chat entry box size, typing off width of screen, slow response time, agent always responding with how to improve instead of just answering question.
FIXED- No faceID auto reentry (expected)
FIXED- Assets not loading? download icon + sketch icon not visible but still respond to touch. Possibly due to manually adding my "main.jsbundle" to Xcode?
FIXED- Download modal calendar extend beyond width of modal
- Physical backend network request failure (expected)
FIXED?- Session creation modal keybaord input only allows for numbers, problems when you change default date entry
- Splash screen shows up for ~15s when opening app on iPhone 
- Add superset button + keyboard sensitive scroll view on gym page
- Keyboard sensitive scrollview responsive to new line on. Anytime someone is typing, the typing line should be visible just above the keyboard.


**Features to add**
IMPLEMENTED- Timestamp entry should be fixed by regex to [0-9]*:[0-9][0-9]. (expected)
IMPLEMENTED- "Note" option should be only text entry (NEED TO IMPLEMENT BACKEND OPERATION FOR NOTE ENTRY, ALTER VALUE SHOWN IN FRONT END OF JOURNALENTRY/INDEX)
IMPLEMENTED- Sketch functions (eraser, undo, color) (expected)
- Time scroll for timestamp
- Arrowhead direction + change dashed arrow + ball + straighten arrows