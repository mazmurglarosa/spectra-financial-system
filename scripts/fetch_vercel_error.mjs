async function check() {
  const res = await fetch('https://spectra-financial-system-hueigoq5x-mazmur.vercel.app');
  const text = await res.text();
  console.log('Page title/meta:');
  const title = text.match(/<title>([^<]+)<\/title>/);
  if (title) console.log('Title:', title[1]);

  // Look for JSON or error strings
  const jsonMatch = text.match(/\{"errorMessage"[^}]+\}/g);
  if (jsonMatch) console.log('Error message JSON:', jsonMatch);

  const errorBlocks = [];
  const lines = text.split('\n');
  lines.forEach(l => {
    if (l.includes('error') || l.includes('Error') || l.includes('failed') || l.includes('dpl_')) {
      errorBlocks.push(l.trim().slice(0, 200));
    }
  });
  console.log('Error lines sample:', errorBlocks.slice(0, 15));
}
check().catch(console.error);
