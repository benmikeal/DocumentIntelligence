/**
 * Migration Script: Upload existing PDFs to Gemini File Search
 */

import { geminiFileSearch } from './src/lib/gemini-file-search';
import { db } from './src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

async function migrateDocuments() {
  console.log('🚀 Starting migration to Gemini File Search\n');

  const pdfsDir = path.join(process.cwd(), 'public', 'pdfs');

  if (!fs.existsSync(pdfsDir)) {
    console.error('❌ PDFs directory not found:', pdfsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(pdfsDir).filter(f => f.endsWith('.pdf'));
  console.log(`📚 Found ${files.length} PDF files to migrate\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(pdfsDir, filename);

    console.log(`[${i + 1}/${files.length}] Processing: ${filename}`);

    try {
      // Upload to Gemini
      const geminiFile = await geminiFileSearch.uploadFile(filePath, filename);

      // Create database record
      await db.document.create({
        data: {
          filename,
          title: filename.replace('.pdf', ''),
          totalPages: 0,
          geminiFileId: geminiFile.name.split('/').pop() || geminiFile.name,
          geminiFileName: geminiFile.name,
          fileSearchStore: 'default',
          indexedAt: new Date(),
          processedAt: new Date(),
        },
      });

      successCount++;
      console.log(`   ✅ Success\n`);
    } catch (error) {
      errorCount++;
      console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
      console.log('');
    }
  }

  console.log('='.repeat(50));
  console.log(`✅ Migration complete!`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${errorCount}`);
  console.log(`   Total: ${files.length}`);
}

migrateDocuments().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
