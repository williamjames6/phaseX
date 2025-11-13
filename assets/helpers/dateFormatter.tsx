//Date formatter function takes a JS date object (stored as milliseconds since UTC epoch@1970 but 
// methods default to local time) and returns a string in the form "YYYY-MM-DD" (backend format)

export const dateFormatter = (date: Date) => {
    return `${date.getFullYear()}` + `-` + `${date.getMonth()+1}` + `-` + `${date.getDate()}`;
}