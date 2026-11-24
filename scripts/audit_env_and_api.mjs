import fs from 'fs';
import path from 'path';

function getFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) results = results.concat(getFiles(fullPath));
    else results.push(fullPath);
  });
  return results;
}

console.log('=== API FILES ===');
console.log(getFiles('api'));

function parseEnvKeys(filePath) {
  if (!fs.existsSync(filePath)) return 'FILE_NOT_FOUND';
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  return lines
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      const key = l.substring(0, idx).trim();
      const val = l.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
      let hint = '';
      if (val.includes('xaafjvmdjdlfqdrljjlr')) hint = '[TARGET: STAGING REF]';
      else if (val.includes('drsqwxkkcfqvooqzoyvm')) hint = '[TARGET: PROD REF]';
      else if (val.includes('qwen/qwen3.8-27b')) hint = '[MODEL: qwen/qwen3.8-27b]';
      else if (val.toLowerCase().includes('llama')) hint = `[MODEL: ${val}]`;
      else if (val.length > 0) hint = `[CONFIGURED: length=${val.length}]`;
      else hint = '[EMPTY]';
      return `${key} = ${hint}`;
    });
}

console.log('\n=== .env.example KEYS ===');
console.log(parseEnvKeys('.env.example'));

console.log('\n=== .env KEYS ===');
console.log(parseEnvKeys('.env'));
