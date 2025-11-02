*** Search Strategy ***

To be implemented in chainRunner.ts

Current approach is equivalent to what the worst case scenario should be: just take 15 most similar actions and append to query.

- For every frontend query from the user, the chainRunner will run multiple steps to deliver the most accurate information to the final query that contains: 
    1) All necessary background information
    2) The user query

---Etapa 1---

1. Make OpenAI call to determine if query asking about a specific date or dates? If so, respond with just the date(s), separated by commas, in the format MM/DD/YYYY. Today's date is {date}. For example, if the query asks 'what did I do yesterday?', the returned response would be '{date - 1}' "
    - Right now, dateCheck is half implemented. Need to clarify flow of construction of finalInputList. Also changed chainRunner function so that "timeSwitch" is not passed as param and "similarActions" is not returned with "assistantText"
    - Potential issue with  UTC instead of local time
    - Need to fix "convertedGymSessionsData" so that a string gets passed into the final "messages" list instead of an object
    - SWITCH TO "RESPONSE" API instead of "CHAT COMPLETIONS"
