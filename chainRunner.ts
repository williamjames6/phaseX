//RAG logic called from home/index.tsx chat screen
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { timeSwitch } from "./assets/helpers/timeSwitch";
interface InputItem {
    role: string;
    content: string;
  }
interface Exercise {
  id: string;
  exercise_name: string;
  superset_number: number;
  exercise_number: number;
  sets: {
    reps: number | null;
    weight: number | null;
    time: number | null;
  }[];
}
const convertJSONBToString = (jsonbData: any): string => {
  if (!jsonbData || typeof jsonbData !== 'object') {
    return 'No gym session data available';
  }
  
  const parts: string[] = [];
  
  Object.entries(jsonbData).forEach(([supersetKey, supersetData]: [string, any]) => {
    const supersetNum = parseInt(supersetKey.replace('superset', ''));
    
    if (!supersetData || typeof supersetData !== 'object') return;
    
    parts.push(`Superset ${supersetNum}:`);
    
    Object.entries(supersetData).forEach(([exerciseKey, exerciseData]: [string, any]) => {
      const exerciseNum = parseInt(exerciseKey.replace('exercise', ''));
      const exerciseName = exerciseData?.exercise_name || 'Unnamed Exercise';
      
      parts.push(`  Exercise ${exerciseNum}: ${exerciseName}`);
      
      if (exerciseData?.sets && typeof exerciseData.sets === 'object') {
        Object.entries(exerciseData.sets).forEach(([setKey, setData]: [string, any]) => {
          const setNum = parseInt(setKey.replace('set', ''));
          const reps = setData?.reps ?? 'N/A';
          const weight = setData?.weight ?? 'N/A';
          const time = setData?.time ?? 'N/A';
          
          parts.push(`    Set ${setNum}: ${reps} reps, ${weight} lbs, ${time} seconds`);
        });
      }
    });
    
    parts.push(''); // Empty line between supersets
  });
  
  return parts.join('\n');
};
const SYSTEM_PROMPT = 'You are a helpful assistant that will aid the user in trying to improve their ' +
            'performance on the football pitch. Answer questions as briefly as possible while still ' +
            'being friendly. Your job is to tailor your answers as much as possible to the input data ' +
            'from the user. Focus on patterns or trends in the query.';

export async function chainRunner(
    query: string,
    supabase: any,
    openaiClient: OpenAI
  ): Promise<{ assistantText: string}> {

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    // Format dates as YYYY-MM-DD
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const todayFormatted = formatDate(today);
    const yesterdayFormatted = formatDate(yesterday);
    
    // Verify user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
  

    //check for relevant dates
    const dateCheckInputList = [];
    dateCheckInputList.push({
        role: 'user',
        content: query
    });
    let messages: ChatCompletionMessageParam[] = [
        {
        role: 'system',
        content: `Your job is to determine if the user query is asking about a specific date or dates? If so, respond with just the date(s), separated by commas, in the format YYYY-MM-DD. If not, return an empty string "". Today the date is ${todayFormatted}. For example, if the query asks "what did I do today?", the returned response would be "${todayFormatted}"`
        },
        ...dateCheckInputList.map<ChatCompletionMessageParam>(item => ({
            role: (item.role === 'assistant' || item.role === 'system') ? item.role : 'user',
            content: item.content
          }))
    ];
    const dateRequest = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages
      });
    const relevantDates = dateRequest.choices[0]?.message?.content ?? '';
    messages = [];
    console.log("today is: ", todayFormatted);
    console.log(relevantDates);
    
    // Validate and parse comma-separated dates in YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const relevantDatesList: string[] = [];
    
    if (relevantDates) {
      // Split by comma, trim whitespace, and validate each date
      const dateStrings = relevantDates.split(',').map(date => date.trim());
      
      dateStrings.forEach(dateStr => {
        if (dateRegex.test(dateStr)) {
          relevantDatesList.push(dateStr);
        }
      });
    }
    
    if (relevantDatesList.length > 0) {
        let gymString = "";
        let sessionString = "";
        let actionString = "";

         //#region Query Actions Table
         // Query Actions table for entries matching relevant dates, process and append to actionString
         const { data: actionsData, error: actionsError } = await supabase
         .from('Actions')
         .select('description, session_date, time_stamp_seconds')
         .in('session_date', relevantDatesList);

         if (actionsError) {
           console.error('Error fetching actions:', actionsError);
         }
         for (const entry of actionsData || []) {
           actionString = actionString + `The action at ${timeSwitch(entry.time_stamp_seconds)} from the session on ${entry.session_date} has the following description: ${entry.description}. `
         }
         //#endregion

         //#region Query GymSessions Table
         // Query GymSessions table for entries matching relevant dates, process and append to gymString
         const { data: gymSessionsData, error: gymSessionsError } = await supabase
             .from('GymSessions')
             .select('data, session_date')
             .in('session_date', relevantDatesList);

         if (gymSessionsError) {
             console.error('Error fetching gym sessions:', gymSessionsError);
         }

         // Convert JSONB data from GymSessions to readable format
         if (gymSessionsData && Array.isArray(gymSessionsData)) {
             const convertedGymSessions = gymSessionsData.map(session => {
                 if (session.data && typeof session.data === 'object') {
                     return {
                         ...session,
                         data: convertJSONBToString(session.data)
                     };
                 }
                 return session;
             });
             console.log('Converted Gym Sessions data:', convertedGymSessions);

             for (const entry of convertedGymSessions) {
                 gymString = gymString + `The gym session on ${entry.session_date} has the following data: ${entry.data}. `
             }
         }
         //#endregion

         //#region Query Sessions Table
         // Query Sessions table for entries matching relevant dates. Since already have all the actions from
         // the actions table, just want to pull high level subjective scores from Sessions table. Process and 
         // append to sessionString
         const { data: fieldSessionData, error: fieldSessionsError } = await supabase
             .from('Sessions')
             .select('date, description, mental_score, overall_score, physical_score, type')
             .in('date', relevantDatesList);

         if (fieldSessionsError) {
             console.error('Error fetching sessions:', fieldSessionsError);
         }

         if (fieldSessionData && Array.isArray(fieldSessionData)) {
             for (const entry of fieldSessionData) {
                 sessionString = sessionString + `The session on ${entry.date} of type ${entry.type} and description ${entry.description} has the following high level data: physical score of ${entry.physical_score}, mental score of ${entry.mental_score}, overall performance score of ${entry.overall_score}. `;
             }
         }
         //#endregion
        
        //#region Check strings
        console.log('Actions data:', actionString);
        console.log('Gym Sessions data:', gymString);
        console.log('Field sessions data: ', sessionString);
        //#endregion
        const relevantDateInputList = [];
        relevantDateInputList.push({
            role: 'user',
            content: 'Relevant field session data: ' + sessionString
        });
        relevantDateInputList.push({
            role: 'user',
            content: 'Relevant actions data: ' + actionString
        });
        relevantDateInputList.push({
            role: 'user',
            content: 'Relevant gym session data: ' + gymString
        });
        relevantDateInputList.push({
            role: 'user',
            content: query
        })
        messages = [
            {
            role: 'system',
            content: SYSTEM_PROMPT
            },
            ...relevantDateInputList.map<ChatCompletionMessageParam>(item => ({
                role: (item.role === 'assistant' || item.role === 'system') ? item.role : 'user',
                content: item.content
            }))
        ];
        console.log("HERE ARE THE MESSAGES FOR SIMILAR DATES: ", messages);
        const datedCompletion = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages
        });

        return {assistantText: datedCompletion.choices[0]?.message?.content ?? '',};
    }
    
    // If no relevant dates found, use similarity search instead
    {   
        console.log("here");
        //clear messages list
        messages = [];
        //generate list of similar actions
        let similarInputList: InputItem[] = [];
        const response = await openaiClient.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
        });
        const embedding = Array.from(response.data[0].embedding);
        let similarActions = [];   
        if (embedding.length === 1536) {
        const { data, error } = await supabase.rpc('search_similar_actions', {
            query_embedding: embedding,
            match_count: 15
        });
        if (error) throw error;
        similarActions = data || [];
        }

        // Populate similarInputList with descriptions from similarActions
        if (similarActions) {
            similarActions.forEach((action: { time_stamp_seconds: number; session_date: any; description: string; }) => {
                similarInputList.push({
                role: 'user',
                content: `This is the data from the action at ${timeSwitch(action.time_stamp_seconds)} from ` +
                        `the session on ${action.session_date}: ${action.description}`
                });
            });
        }
        // Append the user's query to end of similarInputList
        similarInputList.push({
            role: 'user',
            content: query
        });
    
        // Build messages...
        // (rest of RAG logic)
        messages = [
            {
            role: 'system',
            content: 'You are a helpful assistant that will aid the user in trying to improve their' +
            'performance on the football pitch. Answer questions as briefly as possible while still' +
            'being friendly. Your job is to tailor your answers as much as possible to the input data' +
            'from the user. Focus on patterns or trends in the query.'
            },
            ...similarInputList.map<ChatCompletionMessageParam>(item => ({
            role: (item.role === 'assistant' || item.role === 'system') ? item.role : 'user',
            content: item.content
            }))
        ];
    
        // Return LLM completion
        const finalCompletion = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages
        });
    
        return {
          assistantText: finalCompletion.choices[0]?.message?.content ?? '',
        };
    }
  }