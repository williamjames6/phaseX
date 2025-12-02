export function convertToCSV<T extends Record<string, any>>(data: T[]): string {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  
  // Helper function to escape CSV field
  const escapeCSVField = (value: any): string => {
    const stringValue = typeof value === 'string' 
      ? value 
      : JSON.stringify(value ?? '');
    
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };
  
  const rows = data.map(row => 
    headers.map(h => escapeCSVField(row[h])).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}