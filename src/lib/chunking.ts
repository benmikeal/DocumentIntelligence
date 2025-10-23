import { OCRResult } from './ocr'

export interface DocumentChunk {
  id: string
  content: string
  documentId?: string
  documentTitle?: string
  sectionName?: string
  pageNumber: number
  chunkIndex: number
  metadata?: {
    documentId?: string
    startPosition?: number
    endPosition?: number
    wordCount?: number
    charCount?: number
  }
}

export interface ChunkingConfig {
  chunkSize: number
  overlap: number
  minChunkSize: number
  maxChunkSize: number
}

export class DocumentChunker {
  private config: ChunkingConfig

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = {
      chunkSize: 1000,
      overlap: 200,
      minChunkSize: 100,
      maxChunkSize: 2000,
      ...config
    }
  }

  async chunkDocument(
    ocrResults: OCRResult[], 
    documentId: string
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = []
    let globalChunkIndex = 0

    // Combine all pages into a single document with page boundaries
    const fullDocument = ocrResults.map((result, index) => ({
      text: result.text,
      pageNumber: result.metadata.pageNumber,
      sections: result.metadata.sections
    }))

    // Process each page separately first
    for (const page of fullDocument) {
      const pageChunks = await this.chunkPage(page, documentId, globalChunkIndex)
      chunks.push(...pageChunks)
      globalChunkIndex += pageChunks.length
    }

    return chunks
  }

  private async chunkPage(
    page: { text: string; pageNumber: number; sections: string[] },
    documentId: string,
    startChunkIndex: number
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = []
    const { text, pageNumber, sections } = page

    // Split by structural elements (headers)
    const structuralChunks = this.splitByStructure(text, sections)

    let chunkIndex = startChunkIndex

    for (const structuralChunk of structuralChunks) {
      if (structuralChunk.length <= this.config.chunkSize) {
        // Small enough to be a single chunk
        chunks.push(this.createChunk(
          structuralChunk.content,
          documentId,
          pageNumber,
          chunkIndex,
          structuralChunk.section,
          structuralChunk.startPos,
          structuralChunk.endPos
        ))
        chunkIndex++
      } else {
        // Need to split further using sliding window
        const slidingChunks = this.slidingWindowChunk(
          structuralChunk.content,
          documentId,
          pageNumber,
          chunkIndex,
          structuralChunk.section,
          structuralChunk.startPos
        )
        chunks.push(...slidingChunks)
        chunkIndex += slidingChunks.length
      }
    }

    return chunks
  }

  private splitByStructure(text: string, sections: string[]): Array<{
    content: string
    section?: string
    startPos: number
    endPos: number
  }> {
    const structuralChunks: Array<{
      content: string
      section?: string
      startPos: number
      endPos: number
    }> = []

    const lines = text.split('\n')
    let currentSection = ''
    let currentContent = ''
    let startPos = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)

      if (headerMatch) {
        // Save previous section if it exists
        if (currentContent.trim()) {
          structuralChunks.push({
            content: currentContent.trim(),
            section: currentSection || undefined,
            startPos,
            endPos: startPos + currentContent.length
          })
        }

        // Start new section
        currentSection = headerMatch[2].trim()
        currentContent = line + '\n'
        startPos = text.indexOf(line, startPos)
      } else {
        currentContent += line + '\n'
      }
    }

    // Add the last section
    if (currentContent.trim()) {
      structuralChunks.push({
        content: currentContent.trim(),
        section: currentSection || undefined,
        startPos,
        endPos: startPos + currentContent.length
      })
    }

    // If no structural elements found, treat entire text as one chunk
    if (structuralChunks.length === 0) {
      structuralChunks.push({
        content: text,
        startPos: 0,
        endPos: text.length
      })
    }

    return structuralChunks
  }

  private slidingWindowChunk(
    content: string,
    documentId: string,
    pageNumber: number,
    startChunkIndex: number,
    sectionName: string | undefined,
    globalStartPos: number
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    const contentLength = content.length

    let startPos = 0
    let chunkIndex = startChunkIndex

    while (startPos < contentLength) {
      let endPos = Math.min(startPos + this.config.chunkSize, contentLength)
      
      // Try to break at word boundaries
      if (endPos < contentLength) {
        const lastSpace = content.lastIndexOf(' ', endPos)
        if (lastSpace > startPos) {
          endPos = lastSpace
        }
      }

      const chunkContent = content.substring(startPos, endPos).trim()
      
      if (chunkContent.length >= this.config.minChunkSize) {
        chunks.push(this.createChunk(
          chunkContent,
          documentId,
          pageNumber,
          chunkIndex,
          sectionName,
          globalStartPos + startPos,
          globalStartPos + endPos
        ))
        chunkIndex++
      }

      // Move start position with overlap
      startPos = Math.max(startPos + 1, endPos - this.config.overlap)
    }

    return chunks
  }

  private createChunk(
    content: string,
    documentId: string,
    pageNumber: number,
    chunkIndex: number,
    sectionName: string | undefined,
    startPosition: number,
    endPosition: number
  ): DocumentChunk {
    const words = content.split(/\s+/).filter(word => word.length > 0)
    
    return {
      id: `${documentId}-chunk-${chunkIndex}`,
      content,
      sectionName,
      pageNumber,
      chunkIndex,
      metadata: {
        documentId,
        startPosition,
        endPosition,
        wordCount: words.length,
        charCount: content.length
      }
    }
  }

  // Utility method to validate chunk quality
  validateChunk(chunk: DocumentChunk): boolean {
    return (
      chunk.content.length >= this.config.minChunkSize &&
      chunk.content.length <= this.config.maxChunkSize &&
      chunk.metadata.wordCount >= 10 // Minimum meaningful content
    )
  }

  // Method to merge small chunks with neighbors
  mergeSmallChunks(chunks: DocumentChunk[]): DocumentChunk[] {
    const mergedChunks: DocumentChunk[] = []
    let currentMerge: DocumentChunk[] = []

    for (const chunk of chunks) {
      if (this.validateChunk(chunk)) {
        if (currentMerge.length > 0) {
          // Merge accumulated chunks
          mergedChunks.push(this.mergeChunkGroup(currentMerge))
          currentMerge = []
        }
        mergedChunks.push(chunk)
      } else {
        currentMerge.push(chunk)
      }
    }

    // Handle remaining chunks
    if (currentMerge.length > 0) {
      mergedChunks.push(this.mergeChunkGroup(currentMerge))
    }

    return mergedChunks
  }

  private mergeChunkGroup(chunks: DocumentChunk[]): DocumentChunk {
    if (chunks.length === 1) return chunks[0]

    const firstChunk = chunks[0]
    const lastChunk = chunks[chunks.length - 1]

    const mergedContent = chunks.map(c => c.content).join('\n\n')
    const words = mergedContent.split(/\s+/).filter(word => word.length > 0)

    return {
      id: `${firstChunk.metadata.documentId}-merged-${firstChunk.chunkIndex}-${lastChunk.chunkIndex}`,
      content: mergedContent,
      sectionName: firstChunk.sectionName,
      pageNumber: firstChunk.pageNumber,
      chunkIndex: firstChunk.chunkIndex,
      metadata: {
        documentId: firstChunk.metadata.documentId,
        startPosition: firstChunk.metadata.startPosition,
        endPosition: lastChunk.metadata.endPosition,
        wordCount: words.length,
        charCount: mergedContent.length
      }
    }
  }
}