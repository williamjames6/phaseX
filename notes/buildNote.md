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

 3. "Build" in Xcode with desired iOS device selected ( use the .xcworkspace, not .xcodeproj [open -a Xcode ios/phaseX.xcworkspace])

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
FIXED- timeSwitch() on timestamp of actions before appending to chat query is returning "cannot read property 'split' of null"
- Totally convolluted Ref flow for scrollView on gym session
- something maybe not quite right with backend save (sometimes alert will randomly pop up saying something like "failed to save this action" on a blank action without the user pressing anything. Wondering if the React auto runs some refresh on a timer? )
FIXED- UTC for dates of journal entries and gym entries (standardize handling of dates)
- Cannot "undo" on a sketch if you have already left the screen
FIXED- Add gym session button position fixed, should be part of scroll box
- Weird flow with "Load More" button on journal stack index page. recentSessions length returning after calling setRecentSession() to a list of lenght 30. Consider timing of state updates (batched and synchronous) and rendering. Also, OBO error -- last session before the load more button gets repeated when more sessions loaded.
- Backend not functioning properly for trainingLoad page (network error?)~
FIXED- Download function not working across year boundary (i.e. downloads all entries from 2025 but not any from 2026 for date range that spans across the change of year)
    -Problem was dateFormatter helper function, which did not pad single digit months with zeroes.


**Features to add**
IMPLEMENTED- Timestamp entry should be fixed by regex to [0-9]*:[0-9][0-9]. (expected)
IMPLEMENTED- "Note" option should be only text entry (NEED TO IMPLEMENT BACKEND OPERATION FOR NOTE ENTRY, ALTER VALUE SHOWN IN FRONT END OF JOURNALENTRY/INDEX)
IMPLEMENTED- Sketch functions (eraser, undo, color) (expected)
IMPLEMENTED- Time scroll for timestamp
IMPLEMENTED- Arrowhead direction + change dashed arrow + ball + straighten arrows
IMPLEMENTED- Timeout for router.replace("/") on appState going to background
PARTIAL- Linking with [] for timestamps, {} for other dates, and @ for other players
            - Implemented [] and @, but need to add frontend styling (difficult because textInput only takes one value, but I need text with different styling features in the same textInput element)
            - Issues with playerList column in Sessions table, deleting players, running "playerUpdate" function potentially deleting players? Need to standardize timing of backend ops and then link this feature to *ChainRunner.ts*
- Right now, nothing about the chat interaction persists across renders. Very short term --> should be more useful long term
- Forgot password flow + verify email flow
- CHAINRUNNER.TS
- Make subjective feeling for sessions look <Pretty>
- Modify option for session entries
- Self vs other data included
IMPLEMENTED- Holisitic download for all aspects of a givend day of training (Gym + Journal + SS of sketch?) 
            - Problems right now: handling of null/empty returns from backend, formatting of final CSV possibly related to JSON.stringify being called on already stringified content
PARTIAL- Fixed list of exercises
    - Also, history button that shows past performance on a given exercise (stolen from TeamBuildr)
PARTIAL -Sleep section (tracking previous sign in, maybe use push notification or modal to prompt user to input sleep data for previous night)
    -Right now, if it is a user's first login of the day, then a new sleep entry will be created for the previous night in the backend. Also, the previous_sign_in value is updated to the most recent sign in, but only if it is the first sign in of the day (i.e. previous_sign_in is only accurate to the day not the hour. This is because of if/else structure, and early return if the currentTime date is equal to the previous_sign_in date). No modal implementation or sleep stack UX
    -Modal now implemented. Need UX for sleep/entry.jsx.
- Tansition to inputs/outputs structure?
- Added note to top of gym sessions to track any extra info / distinguish between dates if more than one on a given day.