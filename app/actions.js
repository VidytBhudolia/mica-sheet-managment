'use server';

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

const toNumber = value => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function fetchMasterData() {
  try {
    const [skuRes, buyerRes, storageRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'SKU!A2:C',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Buyer!A2:G',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Storage!A2:G',
      }),
    ]);

    const skus = (skuRes.data.values || []).map(row => ({
      productId: row[0] || '',
      description: row[1] || '',
      defaultPrice: toNumber(row[2]),
    }));

    const buyers = (buyerRes.data.values || []).map(row => ({
      buyerId: row[0] || '',
      companyName: row[1] || '',
      poc: row[2] || '',
      contactNumber: row[3] || '',
      email: row[4] || '',
      gstin: row[5] || '',
      address: row[6] || '',
    }));

    const logs = (storageRes.data.values || []).map(row => ({
      date: row[0] || '',
      buyerId: row[1] || '',
      productId: row[2] || '',
      quantity: toNumber(row[3]),
      unitPrice: toNumber(row[4]),
      orderId: row[5] || '',
      notes: row[6] || '',
    }));

    return { skus, buyers, logs };
  } catch (error) {
    console.error('Failed to fetch Google Sheets data:', error);
    return { skus: [], buyers: [], logs: [], error: 'Unable to load Google Sheets data.' };
  }
}

export async function appendOrderLog(orderData) {
  try {
    const unitPrice = Number(orderData.unitPrice);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Storage!A:G',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          orderData.date,
          orderData.buyerId,
          orderData.productId,
          Number(orderData.quantity),
          unitPrice,
          orderData.orderId,
          orderData.notes || '',
        ]],
      },
    });

    // Update last price in SKU sheet column C
    if (orderData.productId && unitPrice > 0) {
      try {
        const skuRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'SKU!A2:A',
        });
        const rows = skuRes.data.values || [];
        const rowIndex = rows.findIndex(row => String(row[0] || '').trim() === String(orderData.productId).trim());
        if (rowIndex !== -1) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `SKU!C${rowIndex + 2}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[unitPrice]] },
          });
        }
      } catch {
        // Non-critical — log still saved even if price update fails
      }
    }

    return { success: true, lastPrice: unitPrice };
  } catch (error) {
    console.error('Failed to append order log:', error);
    return { success: false, error: 'Unable to append order log.' };
  }
}

export async function updateSkuPrice(productId, newPrice) {
  try {
    const normalizedProductId = String(productId || '').trim();
    const parsedPrice = toNumber(newPrice);

    if (!normalizedProductId) {
      return { success: false, error: 'Product ID is required.' };
    }

    const skuRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'SKU!A2:C',
    });

    const rows = skuRes.data.values || [];
    const rowIndex = rows.findIndex(row => String(row[0] || '').trim() === normalizedProductId);

    if (rowIndex === -1) {
      return { success: false, error: 'SKU was not found in the sheet.' };
    }

    const sheetRowNumber = rowIndex + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `SKU!C${sheetRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[parsedPrice]],
      },
    });

    return { success: true, productId: normalizedProductId, defaultPrice: parsedPrice };
  } catch (error) {
    console.error('Failed to update SKU price:', error);
    return { success: false, error: 'Unable to update SKU price.' };
  }
}

export async function getUsersList() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Authorized_Users!A2:E',
    });

    const users = (res.data.values || []).map((row, idx) => ({
      email: (row[0] || '').trim(),
      name: row[1] || '',
      phone: row[2] || '',
      role: row[3] || 'Employee',
      status: row[4] || 'Pending',
      rowIndex: idx + 2,
    }));

    return { success: true, users };
  } catch (error) {
    console.error('Failed to fetch Authorized_Users:', error);
    return { success: false, users: [], error: 'Unable to load users.' };
  }
}

export async function updateUserStatus(rowIndex, newStatus) {
  try {
    const validStatuses = ['Active', 'Terminated', 'Pending'];
    if (!validStatuses.includes(newStatus)) {
      return { success: false, error: 'Invalid status value.' };
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Authorized_Users!E${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[newStatus]],
      },
    });

    return { success: true, rowIndex, status: newStatus };
  } catch (error) {
    console.error('Failed to update user status:', error);
    return { success: false, error: 'Unable to update user status.' };
  }
}

export async function registerNewUser(email, name, phone) {
  try {
    if (!email || !name || !phone) {
      return { success: false, error: 'All fields are required.' };
    }

    // Check if user already exists
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Authorized_Users!A2:A',
    });
    const existingEmails = (res.data.values || []).map(row => (row[0] || '').trim().toLowerCase());
    if (existingEmails.includes(email.trim().toLowerCase())) {
      return { success: false, error: 'User already registered.' };
    }

    // Append new row: Email, Name, Phone, Role, Status
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Authorized_Users!A:E',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[email.trim(), name.trim(), phone.trim(), 'Employee', 'Pending']],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to register new user:', error);
    return { success: false, error: 'Unable to register. Please try again.' };
  }
}
