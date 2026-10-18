import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import JSZip from 'jszip';

const outDir = join(process.cwd(), 'tests', 'fixtures');
const attDir = join(outDir, 'attachments');
mkdirSync(attDir, { recursive: true });

function escapePdfText(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(pages) {
  const objects = new Map();
  const order = [];
  const add = (num, body) => {
    if (!objects.has(num)) order.push(num);
    objects.set(num, body);
  };
  add(1, '<< /Type /Catalog /Pages 2 0 R >>');
  add(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  add(3 + pages.length * 3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontNum = 3 + pages.length * 3;
  pages.forEach((lines, i) => {
    const pageNum = 3 + i * 3;
    const contentNum = pageNum + 1;
    const content = lines.map((line) => `BT /F1 12 Tf 72 720 Td (${escapePdfText(line)}) Tj ET`).join('\n');
    add(pageNum, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents ${contentNum} 0 R >>`);
    add(contentNum, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  const parts = ['%PDF-1.4\n'];
  const offsets = new Map();
  let length = parts[0].length;
  for (const num of order) {
    offsets.set(num, length);
    const body = `${num} 0 obj\n${objects.get(num)}\nendobj\n`;
    parts.push(body);
    length += body.length;
  }
  const xrefStart = length;
  const size = order.length + 1;
  parts.push(`xref\n0 ${size}\n0000000000 65535 f \n`);
  for (const num of order) {
    parts.push(`${String(offsets.get(num)).padStart(10, '0')} 00000 n \n`);
  }
  parts.push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
  return Buffer.from(parts.join(''), 'latin1');
}

const reportPdf = buildPdf([
  [
    'Q3 revenue grew 12 percent year over year to 4.2 million.',
    'Operating margin improved to 18 percent.',
    'Action item: Priya to send the renewal draft to Legal by Friday.',
    'Decision: approved a Q4 budget of 40k for the pilot.',
    'Risk: the supplier clause allows 30 day payment terms.',
  ],
  [
    'Unanswered question: whether the Berlin team can onboard by November.',
    'Key point: churn dropped to 3 percent after the September launch.',
  ],
]);

const scannedPdf = buildPdf([[]]);

writeFileSync(join(attDir, 'q3-report.pdf'), reportPdf);
writeFileSync(join(attDir, 'scanned.pdf'), scannedPdf);

writeFileSync(
  join(attDir, 'notes.txt'),
  'Weekly notes\n\nShipped the reporting dashboard. Customer asked whether CSV export can include custom date ranges. Action item: Marco to investigate feasibility by Wednesday.\n'
);

const docx = new JSZip();
docx.file(
  '[Content_Types].xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
);
docx.file(
  '_rels/.rels',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
);
docx.file(
  'word/document.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Master services agreement</w:t></w:r></w:p>
    <w:p><w:r><w:t>The renewal fee increases by 5 percent annually unless terminated with 60 days notice.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Action item: Legal to countersign by 15 November.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Risk: liability is capped at twice the annual fee.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Unanswered question: whether the cap applies to indirect damages.</w:t></w:r></w:p>
  </w:body>
</w:document>`
);
docx.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
const docxBuffer = await docx.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync(join(attDir, 'contract.docx'), docxBuffer);

writeFileSync(
  join(attDir, 'large.txt'),
  `Quarterly data export\n\n${'The quick brown fox jumps over the lazy dog. '.repeat(12000)}\n`
);

console.log('fixtures written to', attDir);
