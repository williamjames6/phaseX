import { normalizeBase64, parsePDFContent } from './parsePDFContent';

export type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  headers?: {
    name: string;
    value: string;
  }[];
  body?: {
    size?: number;
    attachmentId?: string;
    data?: string;
  };
  parts?: GmailMessagePart[];
};

export type ProcessedAttachment = {
  filename: string;
  contentType: string;
  size: number;
  attachmentId: string | null;
  parsedContent: string;
};

type AttachmentFetcher = (attachmentId: string) => Promise<string>;
type PdfTextExtractor = (pdfBase64: string, filename: string) => Promise<string>;

type ProcessAttachmentOptions = {
  parsePdfText?: PdfTextExtractor;
};

function collectParts(part: GmailMessagePart | undefined): GmailMessagePart[] {
  if (!part) {
    return [];
  }
  return [part, ...(part.parts ?? []).flatMap((childPart) => collectParts(childPart))];
}

export async function processAttachments(
  rootPart: GmailMessagePart | undefined,
  fetchAttachmentData: AttachmentFetcher,
  options?: ProcessAttachmentOptions
): Promise<ProcessedAttachment[]> {
  const parts = collectParts(rootPart);
  const attachments: ProcessedAttachment[] = [];

  for (const part of parts) {
    const contentType = part.mimeType ?? '';
    const filename = part.filename ?? '';
    const attachmentId = part.body?.attachmentId ?? null;
    const isPdf = contentType === 'application/pdf';

    if (!isPdf || (!filename && !attachmentId)) {
      continue;
    }

    try {
      let pdfBase64 = part.body?.data ? normalizeBase64(part.body.data) : '';
      if (!pdfBase64 && attachmentId) {
        const fetchedData = await fetchAttachmentData(attachmentId);
        pdfBase64 = normalizeBase64(fetchedData);
      }

      if (!pdfBase64) {
        throw new Error('No PDF data returned from Gmail attachment payload');
      }

      const fileNameToUse = filename || 'attachment.pdf';
      let extractedText = '';
      if (options?.parsePdfText) {
        try {
          extractedText = await options.parsePdfText(pdfBase64, fileNameToUse);
        } catch {
          extractedText = JSON.parse(parsePDFContent(pdfBase64, fileNameToUse)).data;
        }
      } else {
        extractedText = JSON.parse(parsePDFContent(pdfBase64, fileNameToUse)).data;
      }

      attachments.push({
        filename: fileNameToUse,
        contentType,
        size: part.body?.size ?? 0,
        attachmentId,
        parsedContent: JSON.stringify({
          filename: fileNameToUse,
          mimeType: 'application/pdf',
          data: extractedText,
        }),
      });
    } catch (error) {
      attachments.push({
        filename: filename || 'attachment.pdf',
        contentType,
        size: part.body?.size ?? 0,
        attachmentId,
        parsedContent: JSON.stringify({
          error: 'Failed to process PDF attachment',
          details: error instanceof Error ? error.message : String(error),
        }),
      });
    }
  }

  return attachments;
}
