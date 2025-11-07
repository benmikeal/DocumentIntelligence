/**
 * Document Upload API - Gemini File Search Integration
 *
 * Simplified upload flow:
 * 1. Receive file upload
 * 2. Save temporarily
 * 3. Upload to Gemini File Search
 * 4. Store metadata in database
 * 5. Clean up temporary file
 *
 * No more manual OCR, chunking, or embedding generation!
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { geminiFileSearch } from '@/lib/gemini-file-search';

// Supported file types
const SUPPORTED_MIME_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'text/plain': ['.txt'],
  'application/json': ['.json'],
};

const SUPPORTED_EXTENSIONS = Object.values(SUPPORTED_MIME_TYPES).flat();

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file extension
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        {
          error: `Unsupported file type. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    console.log(`📄 [Upload] Processing file: ${file.name} (${fileExt})`);
    console.log(`📦 [Upload] File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    // Save file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure uploads directory exists
    const uploadsDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const safeFileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    tempFilePath = join(uploadsDir, safeFileName);

    await writeFile(tempFilePath, buffer);
    console.log(`💾 [Upload] Temporary file saved: ${tempFilePath}`);

    // Upload to Gemini File Search
    console.log(`☁️  [Upload] Uploading to Gemini...`);

    const geminiFile = await geminiFileSearch.uploadFile(
      tempFilePath,
      file.name,
      file.type
    );

    console.log(`✅ [Upload] Gemini upload successful!`);
    console.log(`   File ID: ${geminiFile.name}`);
    console.log(`   State: ${geminiFile.state}`);

    // Create document record in database
    const document = await db.document.create({
      data: {
        filename: file.name,
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        totalPages: 0, // Gemini doesn't expose page count directly
        geminiFileId: geminiFile.name.split('/').pop() || geminiFile.name,
        geminiFileName: geminiFile.name,
        fileSearchStore: 'default', // Will implement store management later
        indexedAt: new Date(),
        processedAt: new Date(),
      },
    });

    console.log(`📝 [Upload] Document record created: ${document.id}`);

    // Clean up temporary file
    if (tempFilePath && existsSync(tempFilePath)) {
      await unlink(tempFilePath);
      console.log(`🗑️  [Upload] Temporary file deleted`);
    }

    // Return success response
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        title: document.title,
        geminiFileId: document.geminiFileId,
        indexedAt: document.indexedAt,
      },
      message: 'Document uploaded and indexed successfully!',
    });

  } catch (error) {
    console.error('❌ [Upload] Upload error:', error);

    // Clean up temporary file on error
    if (tempFilePath && existsSync(tempFilePath)) {
      try {
        await unlink(tempFilePath);
        console.log(`🗑️  [Upload] Temporary file cleaned up after error`);
      } catch (cleanupError) {
        console.error('Failed to clean up temporary file:', cleanupError);
      }
    }

    // Return error response
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Upload failed due to an unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to list all uploaded documents
 */
export async function GET() {
  try {
    const documents = await db.document.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        title: true,
        totalPages: true,
        geminiFileId: true,
        indexedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      documents,
      total: documents.length,
    });
  } catch (error) {
    console.error('❌ [Upload] Failed to list documents:', error);

    return NextResponse.json(
      { error: 'Failed to list documents' },
      { status: 500 }
    );
  }
}
