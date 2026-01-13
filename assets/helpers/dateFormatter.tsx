//Date formatter function takes a JS date object (stored as milliseconds since UTC epoch@1970 but 
// methods default to local time) and returns a string in the form "YYYY-MM-DD" (backend format)

export const dateFormatter = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}