import { readFile } from 'fs/promises';
import * as XLSX from 'xlsx';
const buf = await readFile('/sessions/dreamy-nifty-davinci/mnt/uploads/Board-Ready_Business_Model_and_Market_Assessment-Genspark_AI_Sheets-20260224.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });
console.log(JSON.stringify(wb.SheetNames));
for (const name of wb.SheetNames) {
  console.log(`\n=== ${name} ===`);
  const ws = wb.Sheets[name];
  console.log(`Range: ${ws['!ref']}`);
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  for (let r = 0; r < Math.min(json.length, 60); r++) {
    const row = json[r];
    if (!row || row.every(c => c === '')) continue;
    const cells = row.map(c => c === '' ? '' : String(c));
    while (cells.length > 0 && cells[cells.length-1] === '') cells.pop();
    if (cells.length > 0) console.log(`R${r+1}: ${cells.join(' | ')}`);
  }
  if (json.length > 60) console.log(`... (${json.length - 60} more rows)`);
}
