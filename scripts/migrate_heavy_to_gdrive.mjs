import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://drsqwxkkcfqvooqzoyvm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyc3F3eGtrY2Zxdm9vcXpveXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjUyMDMsImV4cCI6MjEwNzY0MTIwM30.5ayLSmloCqvJ1PJsRDGM9ZPbfud-bwOBh0NfyshCOlg';
const GDRIVE_WEBHOOK = 'https://script.google.com/macros/s/AKfycbweEADkAMfpyBXO4j1dBqPTACdrjkR5Pke90h9YxNRGchvA25xP_6JKXHl8e5LPd6bT/exec';
const TARGET_FOLDER_ID = '1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function uploadToGoogleDrive(base64Data, fileName, mimeType = 'image/jpeg') {
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const payload = {
    folderId: TARGET_FOLDER_ID,
    fileName: fileName,
    mimeType: mimeType,
    base64: cleanBase64,
    documentCode: 'SPECTRA-SETTINGS',
    title: fileName
  };

  const response = await fetch(GDRIVE_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });

  const result = await response.json();
  if (result.status === 'success' || result.success) {
    // Generate direct CDN URL for embedding in web
    const directUrl = `https://lh3.googleusercontent.com/d/${result.fileId}`;
    return {
      success: true,
      fileId: result.fileId,
      directUrl: directUrl,
      viewUrl: result.viewUrl
    };
  } else {
    throw new Error(result.message || 'Google Drive upload failed');
  }
}

async function runMigration() {
  console.log('Fetching current company_settings from Supabase...');
  const { data, error } = await supabase.from('company_settings').select('*').limit(1);
  if (error) {
    console.error('Error fetching settings:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No settings row found.');
    return;
  }

  const row = data[0];
  const updates = {};

  // Check login_bg_image
  if (row.login_bg_image && row.login_bg_image.startsWith('data:image')) {
    console.log(`Found heavy Base64 in login_bg_image (${row.login_bg_image.length} chars). Uploading to Google Drive...`);
    const mime = row.login_bg_image.split(';')[0].replace('data:', '') || 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : 'jpg';
    const uploadRes = await uploadToGoogleDrive(row.login_bg_image, `login_background_spectra.${ext}`, mime);
    console.log(`Uploaded! Google Drive File ID: ${uploadRes.fileId}`);
    console.log(`Direct Image URL: ${uploadRes.directUrl}`);
    updates.login_bg_image = uploadRes.directUrl;
  } else {
    console.log('login_bg_image is already a clean URL or empty.');
  }

  // Check booting_bg_image
  if (row.booting_bg_image && row.booting_bg_image.startsWith('data:image')) {
    console.log(`Found heavy Base64 in booting_bg_image (${row.booting_bg_image.length} chars). Uploading to Google Drive...`);
    const mime = row.booting_bg_image.split(';')[0].replace('data:', '') || 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : 'jpg';
    const uploadRes = await uploadToGoogleDrive(row.booting_bg_image, `booting_background_spectra.${ext}`, mime);
    console.log(`Uploaded! Google Drive File ID: ${uploadRes.fileId}`);
    console.log(`Direct Image URL: ${uploadRes.directUrl}`);
    updates.booting_bg_image = uploadRes.directUrl;
  } else {
    console.log('booting_bg_image is already a clean URL or empty.');
  }

  // Check login_logo_url
  if (row.login_logo_url && row.login_logo_url.startsWith('data:image')) {
    console.log(`Found heavy Base64 in login_logo_url (${row.login_logo_url.length} chars). Uploading to Google Drive...`);
    const mime = row.login_logo_url.split(';')[0].replace('data:', '') || 'image/png';
    const ext = mime.includes('png') ? 'png' : 'jpg';
    const uploadRes = await uploadToGoogleDrive(row.login_logo_url, `corporate_logo_spectra.${ext}`, mime);
    console.log(`Uploaded! Google Drive File ID: ${uploadRes.fileId}`);
    console.log(`Direct Image URL: ${uploadRes.directUrl}`);
    updates.login_logo_url = uploadRes.directUrl;
  } else {
    console.log('login_logo_url is already a clean URL or empty.');
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    console.log('Updating Supabase company_settings with lightweight Google Drive URLs...', Object.keys(updates));
    const { error: updateErr } = await supabase.from('company_settings').update(updates).eq('id', row.id);
    if (updateErr) {
      console.error('Failed to update Supabase row:', updateErr);
    } else {
      console.log('SUCCESS! Supabase company_settings updated successfully with lightweight Google Drive links.');
    }
  } else {
    console.log('No heavy files need migrating in Supabase.');
  }
}

runMigration();
