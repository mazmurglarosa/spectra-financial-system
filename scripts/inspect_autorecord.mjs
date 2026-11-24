import fs from 'fs';

const content = fs.readFileSync('src/views/AutoRecordView.tsx', 'utf8');
const lines = content.split('\n');

console.log('=== UPLOAD & CAMERA LINES ===');
lines.forEach((l, i) => {
  if (
    l.includes('type="file"') || 
    l.includes('handleFile') || 
    l.includes('capture') || 
    l.includes('Camera') || 
    l.toLowerCase().includes('pdf')
  ) {
    console.log(`${i + 1}: ${l.trim()}`);
  }
});
