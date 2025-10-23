import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

export async function GET() {
  try {
    // Try to load corpus metadata
    const corpusPath = path.join(process.cwd(), 'data', 'kenya_gov_corpus.json')
    const singleDocPath = path.join(process.cwd(), 'data', 'kenya_mining_rag_data.json')
    const downloadedDocsPath = '/Users/bm/Kenya_Government_Docs'

    let documents: any[] = []
    const processedFilenames = new Set<string>()

    // First, load processed documents from corpus
    if (fs.existsSync(corpusPath)) {
      // Load full corpus
      const rawData = fs.readFileSync(corpusPath, 'utf-8')
      const data = JSON.parse(rawData)

      documents = (data.documents || []).map((doc: any) => {
        const filename = doc.filename || `${doc.title}.pdf`
        processedFilenames.add(filename)
        return {
          id: doc.id,
          filename: filename,
          title: doc.title,
          totalPages: Math.ceil(doc.totalChunks / 3),
          processedAt: doc.processedAt,
          createdAt: doc.processedAt,
          isPreLoaded: true,
          status: 'processed'
        }
      })
    } else if (fs.existsSync(singleDocPath)) {
      // Load single document metadata
      processedFilenames.add('Kenya Mining Handbook 2025.pdf')
      documents = [{
        id: 'kenya-mining-handbook-2025',
        filename: 'Kenya Mining Handbook 2025.pdf',
        title: 'Kenya Mining Investment Handbook 2025',
        totalPages: 50,
        processedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        isPreLoaded: true,
        status: 'processed'
      }]
    }

    // Then, scan for downloaded PDFs that haven't been processed yet
    if (fs.existsSync(downloadedDocsPath)) {
      const files = fs.readdirSync(downloadedDocsPath)
      const pdfFiles = files.filter(f => f.endsWith('.pdf'))

      for (const pdfFile of pdfFiles) {
        if (!processedFilenames.has(pdfFile)) {
          const stats = fs.statSync(path.join(downloadedDocsPath, pdfFile))
          const fileSizeKB = Math.round(stats.size / 1024)

          // Only show PDFs larger than 10KB (filter out redirect/error pages)
          if (fileSizeKB > 10) {
            documents.push({
              id: `pending-${pdfFile}`,
              filename: pdfFile,
              title: pdfFile.replace(/_/g, ' ').replace('.pdf', ''),
              totalPages: Math.ceil(fileSizeKB / 50), // Rough estimate
              processedAt: null,
              createdAt: stats.birthtime.toISOString(),
              isPreLoaded: false,
              status: 'pending',
              fileSize: fileSizeKB
            })
          }
        }
      }
    }

    // Sort: processed first, then by filename
    documents.sort((a, b) => {
      if (a.status === 'processed' && b.status !== 'processed') return -1
      if (a.status !== 'processed' && b.status === 'processed') return 1
      return a.filename.localeCompare(b.filename)
    })

    return NextResponse.json(documents)
  } catch (error) {
    console.error('Error loading documents:', error)
    return NextResponse.json([])
  }
}
