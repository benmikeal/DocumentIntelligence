import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { OCRService } from '@/lib/ocr'
import { DocumentChunker } from '@/lib/chunking'
import { VectorSearchService } from '@/lib/embeddings'

// Global vector search service instance
const vectorSearch = new VectorSearchService()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    }

    // Save file to uploads directory
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const uploadsDir = join(process.cwd(), 'uploads')
    const filePath = join(uploadsDir, file.name)
    
    await writeFile(filePath, buffer)

    // Create document record
    const document = await db.document.create({
      data: {
        filename: file.name,
        title: file.name.replace('.pdf', ''),
        totalPages: 0, // Will be updated after processing
      },
    })

    // Start processing in background
    processDocumentAsync(document.id, filePath, buffer)

    return NextResponse.json(document)
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

async function processDocumentAsync(documentId: string, filePath: string, pdfBuffer: Buffer) {
  try {
    console.log(`Starting processing for document ${documentId}`)
    
    // Initialize services
    const ocrService = new OCRService()
    const chunker = new DocumentChunker()
    
    // Step 1: OCR Processing
    console.log('Step 1: OCR Processing...')
    const ocrResults = await ocrService.processDocumentWithRetry(pdfBuffer)
    console.log(`OCR completed: ${ocrResults.length} pages processed`)
    
    // Update page count
    await db.document.update({
      where: { id: documentId },
      data: { totalPages: ocrResults.length }
    })
    
    // Step 2: Document Chunking
    console.log('Step 2: Document Chunking...')
    const chunks = await chunker.chunkDocument(ocrResults, documentId)
    console.log(`Chunking completed: ${chunks.length} chunks created`)
    
    // Step 3: Store chunks in database
    console.log('Step 3: Storing chunks...')
    for (const chunk of chunks) {
      await db.chunk.create({
        data: {
          id: chunk.id,
          documentId,
          content: chunk.content,
          sectionName: chunk.sectionName,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          metadata: chunk.metadata,
        },
      })
    }
    
    // Step 4: Generate embeddings and index for search
    console.log('Step 4: Generating embeddings...')
    await vectorSearch.indexChunks(chunks)
    
    // Store embeddings in database
    for (const chunk of chunks) {
      const embedding = await vectorSearch['embeddingService'].generateEmbedding(chunk.content)
      await db.embedding.create({
        data: {
          chunkId: chunk.id,
          vector: JSON.stringify(embedding),
          dimension: embedding.length,
        },
      })
    }
    
    // Mark document as processed
    await db.document.update({
      where: { id: documentId },
      data: { processedAt: new Date() }
    })
    
    console.log(`Document ${documentId} processing completed successfully`)
    
  } catch (error) {
    console.error(`Document processing failed for ${documentId}:`, error)
    
    // Mark document as failed (you could add a status field to the schema)
    await db.document.update({
      where: { id: documentId },
      data: { processedAt: new Date() } // Still update to indicate processing attempt
    })
  }
}

// Export the vector search service for use in search API
export { vectorSearch }