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
      range: 'Authorized_Users!A2:C',
    });
    return (res.data.values || []).map((row, idx) => ({
      email: (row[0] || '').trim().toLowerCase(),
      role: row[1] || 'Employee',
      status: row[2] || 'Pending',
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
    async signIn({ user }) {
      try {
        const users = await getAuthorizedUsers();
        const normalizedEmail = (user.email || '').trim().toLowerCase();
        const existing = users.find(u => u.email === normalizedEmail);

        if (!existing) {
          // Auto-signup: append new user as Pending Employee
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Authorized_Users!A:C',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: [[user.email, 'Employee', 'Pending']],
            },
          });
        }

        return true;
      } catch (error) {
        console.error('signIn callback error:', error);
        return true;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
      }
      // Always fetch fresh role/status from sheet
      if (token.email) {
        const users = await getAuthorizedUsers();
        const normalizedEmail = (token.email || '').trim().toLowerCase();
        const found = users.find(u => u.email === normalizedEmail);
        token.role = found?.role || 'Employee';
        token.status = found?.status || 'Pending';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role || 'Employee';
        session.user.status = token.status || 'Pending';
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
