export interface OCRResult {
  text: string
  metadata: {
    pageNumber: number
    confidence: number
    sections: string[]
  }
}

export class OCRService {
  constructor() {
    // No initialization needed
  }

  async processPDF(pdfBuffer: Buffer): Promise<OCRResult[]> {
    try {
      // Dynamic import for CommonJS module
      const pdf = require('pdf-parse')
      const data = await pdf(pdfBuffer)

      // Split into pages (simple approach - assuming uniform page distribution)
      const totalPages = data.numpages || 1
      const textPerPage = Math.ceil(data.text.length / totalPages)
      const results: OCRResult[] = []

      for (let i = 0; i < totalPages; i++) {
        const startIdx = i * textPerPage
        const endIdx = Math.min((i + 1) * textPerPage, data.text.length)
        const pageText = data.text.substring(startIdx, endIdx)
        const sections = this.extractSections(pageText)

        results.push({
          text: pageText,
          metadata: {
            pageNumber: i + 1,
            confidence: 0.95,
            sections
          }
        })
      }

      return results
    } catch (error) {
      console.error('PDF processing failed:', error)
      throw error
    }
  }


  private extractSections(text: string): string[] {
    const sections: string[] = []
    const lines = text.split('\n')
    
    for (const line of lines) {
      // Match markdown headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headerMatch) {
        sections.push(headerMatch[2].trim())
      }
    }
    
    return sections
  }


  async processDocumentWithRetry(pdfBuffer: Buffer, maxRetries: number = 3): Promise<OCRResult[]> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.processPDF(pdfBuffer)
      } catch (error) {
        lastError = error as Error
        console.warn(`OCR attempt ${attempt} failed:`, error)
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError || new Error('OCR processing failed after all retries')
  }
}