export function convertToCSV<T extends Record<string, any>>(data: T[]): string {
    if (!data || data.length === 0) return '';
  
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
  
    return [headers.join(','), ...rows].join('\n');
  }