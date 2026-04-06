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
FIXED?- Session creation modal keybaord input only allows for numbers, problems when you change default date entry
FIXED- Keyboard sensitive scrollview responsive to new line on. Anytime someone is typing, the typing line should be visible just above the keyboard
FIXED- Bug with timestamp because stored as strings, ":" messes with sequential order.
FIXED- timeSwitch() on timestamp of actions before appending to chat query is returning "cannot read property 'split' of null"
_WAITING_- Totally convolluted Ref flow for scrollView on gym session. Need to standardize Ref flow across screens for scrolling
FIXED- something maybe not quite right with backend save (sometimes alert will randomly pop up saying something like "failed to save this action" on a blank action without the user pressing anything. Wondering if the React auto runs some refresh on a timer? )
FIXED- UTC for dates of journal entries and gym entries (standardize handling of dates)
_PARTIAL_- Cannot "undo" on a sketch if you have already left the screen. Also, undo does not work on grey paths.
FIXED- Add gym session button position fixed, should be part of scroll box
_WAITING_- Weird flow with "Load More" button on journal stack index page. recentSessions length returning after calling setRecentSession() to a list of lenght 30. Consider timing of state updates (batched and synchronous) and rendering. Also, OBO error -- last session before the load more button gets repeated when more sessions loaded.
_PARTIAL_- Backend not functioning properly for trainingLoad page (network error?)
    -Switch to Google OAuth sign in thru supabase to access user's gmail account. Currently working on extracting PDF content. Have raw binary in Base64 format but conversion of text characters to human readable text not functioning ATM. 
    -Update: going to use supabse edge function to perform pdf processing because pdf2json package only works in Node runtimes and I do not want to have to host the backend myself. Seems to be a bunch of shit withe Docker and Deno that I need to install to make edge functions work.
FIXED- Download function not working across year boundary (i.e. downloads all entries from 2025 but not any from 2026 for date range that spans across the change of year)
    - Initial problem was dateFormatter helper function, which did not pad single digit months with zeroes.
    -Thought this was fixed, but still not working. Field sessions from 2026 not downloading properly. Also, multiple sessions on a day seems to cause problems
        -Problem was mutliple sessions one day. FieldIndex incremented on first session, but then next session with same date never satisfied constraints to enter into block. Fix: changed from "if" block to "while" block
FIXED- MAJOR PODS BUG PREVENTING BUILD. PROBLEM WITH UDPATE TO EXPO SDK54
    -If ever encountering "bundle not found" error on iPhone build, change scheme from "development build" to "production build". Dev build automatically looks for Metro port.
FIXED- Session meta-scores not saving to backend
    -Was happening only for "Game" type sessions because they go thru different processing flow
_WAITING_- Long hold triggering modal to delete exercise on gym session automatically triggered when focusing "rep", "weight", or "time" input boxes for a given action. Only on actual iPhone build, no indication for app build on simulator. Does not appear for any set of input boxes when they have just been added (i.e. third set added).
_WAITING_-Download and sidebar button logos not centered in iOS button outlines.


**Features to add**
IMPLEMENTED- Timestamp entry should be fixed by regex to [0-9]*:[0-9][0-9]. (expected)
IMPLEMENTED- "Note" option should be only text entry (NEED TO IMPLEMENT BACKEND OPERATION FOR NOTE ENTRY, ALTER VALUE SHOWN IN FRONT END OF JOURNALENTRY/INDEX)
IMPLEMENTED- Sketch functions (eraser, undo, color) (expected)
IMPLEMENTED- Time scroll for timestamp
IMPLEMENTED- Arrowhead direction + change dashed arrow + ball + straighten arrows
IMPLEMENTED- Timeout for router.replace("/") on appState going to background
_PARTIAL_- Linking with [] for timestamps, {} for other dates, and @ for other players
            - Implemented [] and @, but need to add frontend styling (difficult because textInput only takes one value, but I need text with different styling features in the same textInput element)
            - Issues with playerList column in Sessions table, deleting players, running "playerUpdate" function potentially deleting players? Need to standardize timing of backend ops and then link this feature to *ChainRunner.ts*
_WAITING_- Right now, nothing about the chat interaction persists across renders. Very short term --> should be more useful long term
_WAITING_- Forgot password flow + verify email flow
- CHAINRUNNER.TS
_WAITING_- Make subjective feeling for sessions look <Pretty>
_WAITING_- Modify option for session entries
_PARTIAL_- Self vs other data included
IMPLEMENTED- Holisitic download for all aspects of a givend day of training (Gym + Journal + SS of sketch?) 
            - Problems right now: handling of null/empty returns from backend, formatting of final CSV possibly related to JSON.stringify being called on already stringified content
_PARTIAL_- Standardized list of exercises
    - Also, history button that shows past performance on a given exercise (stolen from TeamBuildr)
    - Also, ability to delete exercises from list
_PARTIAL_ -Sleep section (tracking previous sign in, maybe use push notification or modal to prompt user to input sleep data for previous night)
    -Right now, if it is a user's first login of the day, then a new sleep entry will be created for the previous night in the backend. Also, the previous_sign_in value is updated to the most recent sign in, but only if it is the first sign in of the day (i.e. previous_sign_in is only accurate to the day not the hour. This is because of if/else structure, and early return if the currentTime date is equal to the previous_sign_in date). No modal implementation or sleep stack UX
    -Modal now implemented. Need UX for sleep/entry.jsx.
- Tansition to inputs/outputs structure?
IMPLEMENTED- Added note to top of gym sessions to track any extra info / distinguish between dates if more than one on a given day.
-Exercise names not linked to the ExerciseList table in backend for gym stack, so if I change the name in the ExerciseList, then specific exercises from the frontend will not reflect that change and will not be linked to the new exercise name even though they refer to the same exercise. Potentially want to link in backend, but then need a way to retroactively update all previous gym exercise entries so that they connect to the ExerciseList also.

**API dependencies**

-OpenAI API for chainRunner inference + embedding generation
-Supabase API for backend
-Unstructured API for PDF processing