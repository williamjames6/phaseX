export type ParsedPdfContent = {
  filename: string;
  mimeType: 'application/pdf';
  extractedCharCount: number;
  data: string;
};

export function normalizeBase64(base64OrBase64Url: string): string {
  const base64 = base64OrBase64Url.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = base64.length % 4;
  if (remainder === 0) {
    return base64;
  }
  return base64 + '='.repeat(4 - remainder);
}

function decodeBase64ToBinary(base64: string): string {
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(base64);
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;

  for (const char of base64) {
    if (char === '=') {
      break;
    }
    const value = alphabet.indexOf(char);
    if (value === -1) {
      continue;
    }
    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

function decodePdfLiteralBytes(bytes: number[]): string {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let utf16Text = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      utf16Text += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return utf16Text;
  }
  return String.fromCharCode(...bytes);
}

function parseLiteralString(binary: string, startIndex: number): { text: string; nextIndex: number } {
  const bytes: number[] = [];
  let depth = 1;
  let index = startIndex + 1;

  while (index < binary.length) {
    const char = binary[index];

    if (char === '\\') {
      index += 1;
      if (index >= binary.length) {
        break;
      }

      const escaped = binary[index];
      const map: Record<string, number> = {
        n: 0x0a,
        r: 0x0d,
        t: 0x09,
        b: 0x08,
        f: 0x0c,
        '(': 0x28,
        ')': 0x29,
        '\\': 0x5c,
      };

      if (map[escaped] !== undefined) {
        bytes.push(map[escaped]);
        index += 1;
        continue;
      }

      if (/[0-7]/.test(escaped)) {
        let octal = escaped;
        for (let j = 0; j < 2; j += 1) {
          const next = binary[index + 1];
          if (next && /[0-7]/.test(next)) {
            octal += next;
            index += 1;
          } else {
            break;
          }
        }
        bytes.push(parseInt(octal, 8) & 0xff);
        index += 1;
        continue;
      }

      if (escaped === '\n' || escaped === '\r') {
        index += 1;
        if (escaped === '\r' && binary[index] === '\n') {
          index += 1;
        }
        continue;
      }

      bytes.push(escaped.charCodeAt(0));
      index += 1;
      continue;
    }

    if (char === '(') {
      depth += 1;
      bytes.push(char.charCodeAt(0));
      index += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return { text: decodePdfLiteralBytes(bytes), nextIndex: index + 1 };
      }
      bytes.push(char.charCodeAt(0));
      index += 1;
      continue;
    }

    bytes.push(char.charCodeAt(0));
    index += 1;
  }

  return { text: decodePdfLiteralBytes(bytes), nextIndex: index };
}

function extractPdfText(binary: string): string {
  const candidates: string[] = [];
  let index = 0;

  while (index < binary.length) {
    if (binary[index] === '(') {
      const { text, nextIndex } = parseLiteralString(binary, index);
      candidates.push(text);
      index = nextIndex;
      continue;
    }
    index += 1;
  }

  const cleaned = candidates
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value) => value.length > 1)
    .filter((value) => /[A-Za-z0-9]/.test(value));

  return cleaned.join('\n');
}

// Extract best-effort readable text content from PDF bytes for downstream parsing.
export function parsePDFContent(pdfBase64: string, filename: string): string {
  const normalized = normalizeBase64(pdfBase64);
  const binaryPdf = decodeBase64ToBinary(normalized);
  const extractedText = extractPdfText(binaryPdf);
  const payload: ParsedPdfContent = {
    filename,
    mimeType: 'application/pdf',
    extractedCharCount: extractedText.length,
    data: extractedText,
  };
  return JSON.stringify(payload);
}
