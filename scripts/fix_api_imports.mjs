import fs from 'fs';
import path from 'path';

function getTsFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const f of list) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) results = results.concat(getTsFiles(full));
    else if (f.endsWith('.ts') || f.endsWith('.mjs')) results.push(full);
  }
  return results;
}

const files = getTsFiles('api').concat(['scripts/test_backend_auth_and_groq.mjs']);
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let updated = content
    .replace(/from\s+['"](\.\.\/\.\.\/)lib\/([^'"]+)['"]/g, 'from "$1_lib/$2.js"')
    .replace(/from\s+['"](\.\.\/)lib\/([^'"]+)['"]/g, 'from "$1_lib/$2.js"')
    .replace(/from\s+['"](\.\/)lib\/([^'"]+)['"]/g, 'from "$1_lib/$2.js"')
    .replace(/from\s+['"](\.\.\/\.\.\/)_lib\/([^'"]+?)(?:\.js|\.ts)?['"]/g, 'from "$1_lib/$2.js"')
    .replace(/from\s+['"](\.\.\/)_lib\/([^'"]+?)(?:\.js|\.ts)?['"]/g, 'from "$1_lib/$2.js"')
    .replace(/from\s+['"](\.\/)_lib\/([^'"]+?)(?:\.js|\.ts)?['"]/g, 'from "$1_lib/$2.js"')
    .replace(/\.js\.js/g, '.js');
    
  if (f.includes('test_backend_auth_and_groq')) {
    updated = updated.replace(/api\/lib\//g, 'api/_lib/');
  }
  if (content !== updated) {
    fs.writeFileSync(f, updated, 'utf8');
    console.log('Updated imports in:', f);
  }
});
