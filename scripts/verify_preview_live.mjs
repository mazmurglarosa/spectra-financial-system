async function check() {
  const branchUrl = 'https://spectra-financial-system-git-feature-secure-auth-groq-mazmur.vercel.app';
  const res = await fetch(branchUrl);
  const text = await res.text();
  console.log('HTTP Status:', res.status);
  const titleMatch = text.match(/<title>([^<]+)<\/title>/);
  console.log('Title:', titleMatch ? titleMatch[1] : 'No title');
  const hasAppRoot = text.includes('id="root"');
  console.log('Has #root div:', hasAppRoot);
  const scriptMatch = text.match(/src="(\/assets\/[^"]+)"/g);
  console.log('Bundled Assets:', scriptMatch);
}
check().catch(console.error);
