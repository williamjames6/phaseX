# PhaseX Backend

This is the backend server for PhaseX, featuring Gmail IMAP integration.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Gmail:
   - Enable 2-factor authentication in your Google Account
   - Generate an App Password:
     1. Go to Google Account settings
     2. Security
     3. 2-Step Verification
     4. App passwords
     5. Generate a new app password for "Mail"
   - Copy the generated password

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the following variables:
     - `GMAIL_USER`: Your Gmail address
     - `GMAIL_PASSWORD`: Your Gmail app password
     - `PORT`: Server port (default: 3000)

## Running the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### GET /api/emails
Fetches all emails from the last 7 days.

### GET /api/emails/:id
Fetches a specific email by ID.

## Security Notes

- Never commit your `.env` file
- Use app passwords instead of your main Gmail password
- Keep your credentials secure 