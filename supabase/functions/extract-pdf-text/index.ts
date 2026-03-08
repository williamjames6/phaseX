// @ts-nocheck

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeBase64(base64OrBase64Url: string): string {
  const base64 = base64OrBase64Url.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = base64.length % 4;
  if (remainder === 0) {
    return base64;
  }
  return base64 + '='.repeat(4 - remainder);
}

function base64ToBytes(base64OrBase64Url: string): Uint8Array {
  const normalized = normalizeBase64(base64OrBase64Url);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildUnstructuredHeaders(apiKey: string): Headers {
  const headers = new Headers();
  headers.set('unstructured-api-key', apiKey);
  return headers;
}

function getMetadataString(metadata: Record<string, unknown> | undefined, key: string): string {
  if (!metadata) return '';
  const value = metadata[key];
  return typeof value === 'string' ? value.trim() : '';
}

function extractFromUnstructuredOutput(output: unknown): {
  text: string;
  figureText: string;
  tableText: string;
  elementCount: number;
} {
  const elements = Array.isArray(output)
    ? output
    : Array.isArray((output as { elements?: unknown[] } | null)?.elements)
      ? (output as { elements: unknown[] }).elements
      : [];

  const textParts: string[] = [];
  const figureParts: string[] = [];
  const tableParts: string[] = [];

  for (const rawElement of elements) {
    if (!rawElement || typeof rawElement !== 'object') continue;
    const element = rawElement as Record<string, unknown>;
    const type = (typeof element.type === 'string' ? element.type : '').toLowerCase();
    const text = (typeof element.text === 'string' ? element.text : '').trim();
    const metadata = (element.metadata && typeof element.metadata === 'object')
      ? (element.metadata as Record<string, unknown>)
      : undefined;

    const imageDescription = getMetadataString(metadata, 'image_description');
    const imageText = getMetadataString(metadata, 'image_text');
    const figureCaption = getMetadataString(metadata, 'figure_caption');
    const tableHtml = getMetadataString(metadata, 'text_as_html');

    if (text) textParts.push(text);
    if (imageDescription) figureParts.push(imageDescription);
    if (imageText) figureParts.push(imageText);
    if (figureCaption) figureParts.push(figureCaption);
    if (tableHtml) tableParts.push(tableHtml);

    if (type.includes('figure') || type.includes('image') || type.includes('caption')) {
      if (text) figureParts.push(text);
    }
    if (type.includes('table') && text) {
      tableParts.push(text);
    }
  }

  return {
    text: textParts.join('\n').trim(),
    figureText: figureParts.join('\n').trim(),
    tableText: tableParts.join('\n').trim(),
    elementCount: elements.length,
  };
}

async function createJob(
  apiBaseUrl: string,
  apiKey: string,
  bytes: Uint8Array,
  filename: string
): Promise<{ id: string; input_file_ids?: string[] }> {
  const formData = new FormData();
  const safeFilename = filename || 'document.pdf';
  const file = new File([bytes], safeFilename, { type: 'application/pdf' });
  formData.append('input_files', file);

  // "hi_res_and_enrichment" is Unstructured's on-demand template for higher quality extraction
  // and enrichment of visual content such as figures/images where supported.
  formData.append('request_data', JSON.stringify({ template_id: 'hi_res_and_enrichment' }));

  const response = await fetch(`${apiBaseUrl}/api/v1/jobs/`, {
    method: 'POST',
    headers: buildUnstructuredHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Unstructured create job failed (${response.status}): ${details}`);
  }

  const job = await response.json() as { id?: string; input_file_ids?: string[] };
  if (!job?.id) {
    throw new Error('Unstructured create job returned no job id');
  }
  return { id: job.id, input_file_ids: job.input_file_ids };
}

async function waitForJobCompletion(
  apiBaseUrl: string,
  apiKey: string,
  jobId: string,
  maxAttempts = 60
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`${apiBaseUrl}/api/v1/jobs/${jobId}/details`, {
      method: 'GET',
      headers: buildUnstructuredHeaders(apiKey),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Unstructured job details failed (${response.status}): ${details}`);
    }

    const details = await response.json() as { processing_status?: string; message?: string };
    const status = details?.processing_status;

    if (status === 'SUCCESS' || status === 'COMPLETED_WITH_ERRORS') {
      return;
    }
    if (status === 'FAILED' || status === 'STOPPED') {
      throw new Error(`Unstructured job ended with status ${status}: ${details?.message ?? 'no message'}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Unstructured job timed out while waiting for completion');
}

async function getJobInfo(
  apiBaseUrl: string,
  apiKey: string,
  jobId: string
): Promise<{ input_file_ids?: string[] }> {
  const response = await fetch(`${apiBaseUrl}/api/v1/jobs/${jobId}`, {
    method: 'GET',
    headers: buildUnstructuredHeaders(apiKey),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Unstructured get job failed (${response.status}): ${details}`);
  }

  return await response.json() as { input_file_ids?: string[] };
}

async function downloadJobOutput(
  apiBaseUrl: string,
  apiKey: string,
  jobId: string,
  fileId: string
): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}/api/v1/jobs/${jobId}/download?file_id=${encodeURIComponent(fileId)}`, {
    method: 'GET',
    headers: buildUnstructuredHeaders(apiKey),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Unstructured download output failed (${response.status}): ${details}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const pdfBase64 = body?.pdfBase64;
    const filename = typeof body?.filename === 'string' ? body.filename : 'document.pdf';
    const unstructuredApiKey = Deno.env.get('UNSTRUCTURED_API_KEY');
    const unstructuredApiUrl = (Deno.env.get('UNSTRUCTURED_API_URL') ?? 'https://platform.unstructuredapp.io').replace(/\/$/, '');

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'pdfBase64 is required and must be a string' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!unstructuredApiKey) {
      return new Response(JSON.stringify({ error: 'UNSTRUCTURED_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bytes = base64ToBytes(pdfBase64);
    const createdJob = await createJob(unstructuredApiUrl, unstructuredApiKey, bytes, filename);
    const jobId = createdJob.id;
    await waitForJobCompletion(unstructuredApiUrl, unstructuredApiKey, jobId);

    const jobInfo = await getJobInfo(unstructuredApiUrl, unstructuredApiKey, jobId);
    const inputFileIds = jobInfo.input_file_ids ?? createdJob.input_file_ids ?? [];
    if (inputFileIds.length === 0) {
      throw new Error('Unstructured job returned no input file ids');
    }

    const combined = {
      text: '',
      figureText: '',
      tableText: '',
      elementCount: 0,
    };

    for (const fileId of inputFileIds) {
      const output = await downloadJobOutput(unstructuredApiUrl, unstructuredApiKey, jobId, fileId);
      const extracted = extractFromUnstructuredOutput(output);
      if (extracted.text) combined.text += (combined.text ? '\n' : '') + extracted.text;
      if (extracted.figureText) combined.figureText += (combined.figureText ? '\n' : '') + extracted.figureText;
      if (extracted.tableText) combined.tableText += (combined.tableText ? '\n' : '') + extracted.tableText;
      combined.elementCount += extracted.elementCount;
    }

    return new Response(
      JSON.stringify({
        text: combined.text,
        figureText: combined.figureText,
        tableText: combined.tableText,
        elementCount: combined.elementCount,
        parser: 'unstructured',
        jobId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('extract-pdf-text function error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to extract PDF text',
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
