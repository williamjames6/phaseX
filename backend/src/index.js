import cors from 'cors';
import express from 'express';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import PDFParser from 'pdf2json';
import { config } from '../backend.config.js';

// Get the directory name
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Load environment variables from the correct path
// dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Debug log environment variables
console.log('Environment check:');
console.log('GMAIL_USER:', config?.gmailUser ? 'Set' : 'Not set');
console.log('GMAIL_PASSWORD:', config?.gmailPassword ? 'Set' : 'Not set');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Create a new IMAP client instance
function createImapClient() {
  return new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: config.gmailUser,
      pass: config.gmailPassword
    }
  });
}

// Helper function to ensure connection
async function withImapConnection(operation) {
  const client = createImapClient();
  try {
    await client.connect();
    console.log('Connected to Gmail IMAP');
    const result = await operation(client);
    return result;
  } catch (error) {
    console.error('IMAP operation failed:', error);
    throw error;
  } finally {
    try {
      await client.logout();
      console.log('Disconnected from Gmail IMAP');
    } catch (logoutError) {
      console.error('Error during logout:', logoutError);
    }
  }
}

// Helper function to parse PDF content
function parsePDFContent(pdfBuffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1); // Set verbosity to 1 for more detailed output
    
    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        // Get all text content from the PDF
        const text = pdfParser.getRawTextContent();
        console.log('PDF Text Content:', text); // Debug log
        
        resolve({
          text: text || '',
          numPages: pdfData.Pages.length
        });
      } catch (error) {
        console.error('Error processing PDF data:', error);
        reject(error);
      }
    });

    pdfParser.on('pdfParser_dataError', (error) => {
      console.error('PDF parsing error:', error);
      reject(error);
    });

    try {
      // Parse the PDF buffer
      pdfParser.parseBuffer(pdfBuffer);
    } catch (error) {
      console.error('Error initiating PDF parse:', error);
      reject(error);
    }
  });
}

// Helper function to process attachments
async function processAttachments(parsed) {
  const attachments = [];
  if (parsed.attachments && parsed.attachments.length > 0) {
    for (const attachment of parsed.attachments) {
      try {
        let parsedContent = null;

        if (attachment.contentType === 'application/pdf') {
          console.log(`Processing PDF attachment: ${attachment.filename}`);
          // Parse PDF content
          parsedContent = await parsePDFContent(attachment.content);
          console.log(`PDF content length: ${parsedContent.text.length}`);
        } else {
          // For non-PDF attachments, just convert to base64
          parsedContent = {
            text: attachment.content.toString('base64')
          };
        }

        attachments.push({
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          parsedContent: parsedContent
        });
      } catch (error) {
        console.error(`Error processing attachment ${attachment.filename}:`, error);
        attachments.push({
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          error: 'Failed to process attachment'
        });
      }
    }
  }
  return attachments;
}

// Endpoint to fetch emails from a specific sender in physicalData folder
app.get('/api/emails/from/:sender', async (req, res) => {
  try {
    const sender = decodeURIComponent(req.params.sender);
    console.log(`Searching for emails from: ${sender}`);
    
    const emails = await withImapConnection(async (client) => {
      // Select the physicalData folder
      const mailbox = await client.mailboxOpen('physicalData');
      console.log(`Opened mailbox: ${mailbox.name}, ${mailbox.exists} messages`);
      
      // Search for emails from the specific sender
      const messages = await client.search({
        from: sender
      });
      console.log(`Found ${messages.length} messages from ${sender}`);

      const emails = [];
      
      // Fetch email details
      for (const uid of messages) {
        try {
          console.log(`Fetching email with UID: ${uid}`);
          const email = await client.download(uid);
          
          if (!email || !email.content) {
            console.warn(`No content for email UID: ${uid}`);
            continue;
          }

          const parsed = await simpleParser(email.content);
          console.log(`Successfully parsed email UID: ${uid}, Subject: ${parsed.subject}`);
          
          // Process attachments
          const attachments = await processAttachments(parsed);
          console.log(`Found ${attachments.length} attachments in email UID: ${uid}`);
          
          emails.push({
            id: uid,
            subject: parsed.subject || '(No Subject)',
            from: parsed.from?.text || 'Unknown',
            date: parsed.date || new Date(),
            text: parsed.text || '',
            html: parsed.html || '',
            attachments: attachments
          });
        } catch (emailError) {
          console.error(`Error processing email UID ${uid}:`, emailError);
          continue;
        }
      }

      return emails;
    });

    console.log(`Successfully processed ${emails.length} emails from ${sender}`);
    res.json(emails);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ 
      error: 'Failed to fetch emails',
      details: error.message 
    });
  }
});

// Endpoint to fetch all emails from physicalData folder
app.get('/api/emails', async (req, res) => {
  try {
    const emails = await withImapConnection(async (client) => {
      // Select the physicalData folder
      const mailbox = await client.mailboxOpen('physicalData');
      console.log(`Opened mailbox: ${mailbox.name}, ${mailbox.exists} messages`);
      
      // Search for all emails
      const messages = await client.search({});
      console.log(`Found ${messages.length} messages`);

      const emails = [];
      
      // Fetch email details
      for (const uid of messages) {
        try {
          console.log(`Fetching email with UID: ${uid}`);
          const email = await client.download(uid);
          
          if (!email || !email.content) {
            console.warn(`No content for email UID: ${uid}`);
            continue;
          }

          const parsed = await simpleParser(email.content);
          console.log(`Successfully parsed email UID: ${uid}, Subject: ${parsed.subject}`);
          
          // Process attachments
          const attachments = await processAttachments(parsed);
          console.log(`Found ${attachments.length} attachments in email UID: ${uid}`);
          
          emails.push({
            id: uid,
            subject: parsed.subject || '(No Subject)',
            from: parsed.from?.text || 'Unknown',
            date: parsed.date || new Date(),
            text: parsed.text || '',
            html: parsed.html || '',
            attachments: attachments
          });
        } catch (emailError) {
          console.error(`Error processing email UID ${uid}:`, emailError);
          continue;
        }
      }

      return emails;
    });

    console.log(`Successfully processed ${emails.length} emails`);
    res.json(emails);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ 
      error: 'Failed to fetch emails',
      details: error.message 
    });
  }
});

// Endpoint to fetch a specific email from physicalData folder
app.get('/api/emails/:id', async (req, res) => {
  try {
    const emailId = parseInt(req.params.id);
    console.log(`Fetching specific email with UID: ${emailId}`);
    
    const email = await withImapConnection(async (client) => {
      // Select the physicalData folder
      await client.mailboxOpen('physicalData');
      
      const email = await client.download(emailId);
      
      if (!email || !email.content) {
        throw new Error('Email not found or has no content');
      }

      const parsed = await simpleParser(email.content);
      console.log(`Successfully parsed email UID: ${emailId}, Subject: ${parsed.subject}`);
      
      // Process attachments
      const attachments = await processAttachments(parsed);
      console.log(`Found ${attachments.length} attachments in email UID: ${emailId}`);
      
      return {
        id: emailId,
        subject: parsed.subject || '(No Subject)',
        from: parsed.from?.text || 'Unknown',
        date: parsed.date || new Date(),
        text: parsed.text || '',
        html: parsed.html || '',
        attachments: attachments
      };
    });

    res.json(email);
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({ 
      error: 'Failed to fetch email',
      details: error.message 
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 