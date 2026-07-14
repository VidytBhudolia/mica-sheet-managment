import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function getAuthorizedUsers() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Authorized_Users!A2:E',
    });
    return (res.data.values || []).map((row, idx) => ({
      email: (row[0] || '').trim().toLowerCase(),
      name: row[1] || '',
      phone: row[2] || '',
      role: row[3] || 'Employee',
      status: row[4] || 'Pending',
      rowIndex: idx + 2,
    }));
  } catch (error) {
    console.error('Failed to fetch Authorized_Users:', error);
    return [];
  }
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn() {
      // Always allow sign-in; registration handled separately
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
      }
      // Fetch fresh role/status from sheet
      if (token.email) {
        const users = await getAuthorizedUsers();
        const normalizedEmail = (token.email || '').trim().toLowerCase();
        const found = users.find(u => u.email === normalizedEmail);
        if (found) {
          token.role = found.role;
          token.status = found.status;
          token.registeredName = found.name;
          token.isRegistered = true;
        } else {
          token.role = 'Employee';
          token.status = 'New';
          token.registeredName = '';
          token.isRegistered = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role || 'Employee';
        session.user.status = token.status || 'New';
        session.user.registeredName = token.registeredName || '';
        session.user.isRegistered = token.isRegistered || false;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
