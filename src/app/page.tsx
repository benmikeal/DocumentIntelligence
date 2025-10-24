'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Upload, Search, FileText, Loader2, CheckCircle, AlertCircle, BarChart3, Clock, X, ExternalLink, Download } from 'lucide-react'

interface Document {
  id: string
  filename: string
  title?: string
  totalPages: number
  processedAt: string | null
  createdAt: string
  status?: 'processed' | 'pending'
  isPreLoaded?: boolean
  fileSize?: number
}

interface SearchResult {
  id: string
  content: string
  sectionName?: string
  documentTitle: string
  relevanceScore: number
  pageNumber?: number
}

interface DocumentView {
  documentTitle: string
  documentId?: string
  content: string
  highlightSection?: string
}

export default function DocumentIntelligenceSystem() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [documentView, setDocumentView] = useState<DocumentView | null>(null)
  const [isLoadingDocument, setIsLoadingDocument] = useState(false)
  const [corpusStats, setCorpusStats] = useState<{
    totalDocuments: number
    totalChunks: number
    embeddingDimension: number
    processedDocs: number
  } | null>(null)

  const exampleQuestions = [
    "What are the investment incentives in Kenya?",
    "How do I apply for a work permit in Kenya?",
    "What are the tax procedures for foreign investors?",
    "What is the process for registering land in Kenya?",
    "What are the benefits of Special Economic Zones?",
    "How do I protect my foreign investment in Kenya?",
    "What are the employment regulations in Kenya?",
    "What is Kenya Vision 2030's economic strategy?",
    "What are the PPP project opportunities in Kenya?",
    "How do I register a company in Kenya?",
    "What are the customs and import procedures?",
    "What are the data protection requirements in Kenya?"
  ]

  // Load pre-loaded documents and corpus stats on mount
  useEffect(() => {
    // Fetch document list
    fetch('/api/documents/list')
      .then(res => res.json())
      .then(docs => {
        if (Array.isArray(docs)) {
          setDocuments(docs)
        }
      })
      .catch(error => console.error('Failed to load documents:', error))

    // Fetch corpus statistics
    fetch('/api/corpus/stats')
      .then(res => res.json())
      .then(stats => {
        setCorpusStats(stats)
      })
      .catch(error => console.error('Failed to load corpus stats:', error))
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (response.ok) {
        const newDocument = await response.json()
        setDocuments(prev => [newDocument, ...prev])
        setSelectedFile(null)
      }
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
      setTimeout(() => setUploadProgress(0), 1000)
    }
  }

  const handleSearch = async (query: string) => {
    if (!query.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      if (response.ok) {
        const results = await response.json()
        setSearchResults(results)
      }
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleOpenDocument = async (documentTitle: string, documentId?: string, highlightSection?: string) => {
    setIsLoadingDocument(true)
    try {
      // Fetch the full document content from the corpus
      const response = await fetch('/api/documents/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentTitle, documentId }),
      })

      if (response.ok) {
        const data = await response.json()
        setDocumentView({
          documentTitle,
          documentId,
          content: data.content,
          highlightSection
        })
      }
    } catch (error) {
      console.error('Failed to load document:', error)
    } finally {
      setIsLoadingDocument(false)
    }
  }

  const handleDownloadDocument = (documentTitle: string) => {
    // Convert document title to PDF filename
    // The batch script converts titles like "KRA Tax Procedures" to "kra-tax-procedures"
    const filename = documentTitle.replace(/\s+/g, '_') + '.pdf'

    // Trigger download
    window.open(`/api/documents/download/${filename}`, '_blank')
  }

  const stats = {
    totalDocuments: corpusStats?.totalDocuments || documents.length,
    processedDocuments: corpusStats?.processedDocs || documents.filter(d => d.status === 'processed').length,
    totalChunks: corpusStats?.totalChunks || documents.reduce((acc, doc) => acc + doc.totalPages * 3, 0),
    totalEmbeddings: corpusStats?.totalChunks || documents.reduce((acc, doc) => acc + doc.totalPages * 3, 0),
    embeddingDimension: corpusStats?.embeddingDimension || 384,
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Kenya Government Document Intelligence</h1>
          <p className="text-muted-foreground text-lg">
            Lead Kenya's leap into intelligent governance. Built on state-of-the-art Qwen2.5-VL-7B OCR and all-MiniLM-L6-v2 semantic AI, our system has already transformed 50+ documents into 1,374 instantly-accessible knowledge segments. Senior officials extract precise answers from decades of institutional expertise in under a second through advanced vector search—delivering the competitive edge of AI-first government operations.
          </p>
        </div>

        <Tabs defaultValue="search" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="upload">Upload Documents</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Semantic Search
                </CardTitle>
                <CardDescription>
                  Ask questions about your documents using natural language
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Enter your question here..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <Button
                    onClick={() => handleSearch(searchQuery)}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-6"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Searching...
                      </>
                    ) : (
                      'Search'
                    )}
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Example questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {exampleQuestions.map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        disabled={isSearching}
                        onClick={() => {
                          setSearchQuery(question)
                          handleSearch(question)
                        }}
                        className="text-xs"
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Loading State */}
            {isSearching && (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg font-medium">Searching through documents...</p>
                    <p className="text-sm text-muted-foreground">This should only take a moment</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search Results */}
            {!isSearching && searchResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Search Results</CardTitle>
                  <CardDescription>
                    Found {searchResults.length} relevant results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {searchResults.map((result, index) => (
                        <Card
                          key={result.id}
                          className="border-l-4 border-l-primary hover:shadow-md transition-shadow"
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">
                                    {result.documentTitle}
                                  </Badge>
                                </div>
                                {result.sectionName && (
                                  <p className="text-sm text-muted-foreground">
                                    Section: {result.sectionName}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <Badge variant="outline">
                                  {Math.round(result.relevanceScore * 100)}% match
                                </Badge>
                                {result.pageNumber && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Page {result.pageNumber}
                                  </p>
                                )}
                              </div>
                            </div>
                            <p className="text-sm leading-relaxed mb-3">{result.content}</p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDocument(result.documentTitle, result.id, result.sectionName)}
                                className="flex-1"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Document
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDownloadDocument(result.documentTitle)
                                }}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download PDF
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Documents
                </CardTitle>
                <CardDescription>
                  Upload PDF documents for processing and indexing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <div className="space-y-2">
                    <p className="text-lg font-medium">Upload Custom Documents</p>
                    <p className="text-sm text-muted-foreground">
                      Premium feature - Upgrade to upload your own PDFs
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowSubscriptionModal(true)}
                    className="mt-4"
                    size="lg"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upgrade to Upload
                  </Button>
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">{selectedFile.name}</span>
                    {isUploading && (
                      <Loader2 className="h-4 w-4 animate-spin ml-auto" />
                    )}
                  </div>
                )}

                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing document...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Document List */}
            {documents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Document Library</CardTitle>
                  <CardDescription>
                    {documents.filter(d => d.status === 'processed').length} processed • {' '}
                    {documents.filter(d => d.status === 'pending').length} pending extraction
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                            doc.status === 'processed'
                              ? 'hover:bg-muted/50 cursor-pointer'
                              : 'opacity-60'
                          }`}
                          onClick={() => doc.status === 'processed' && handleOpenDocument(doc.filename, doc.id)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{doc.filename}</p>
                                {doc.status === 'processed' && (
                                  <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {doc.totalPages} pages • {new Date(doc.createdAt).toLocaleDateString()}
                                {doc.status === 'pending' && doc.fileSize && ` • ${Math.round(doc.fileSize / 1024)} MB`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {doc.status === 'processed' ? (
                              <>
                                <Badge variant="secondary" className="text-xs">
                                  Searchable
                                </Badge>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              </>
                            ) : (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  Pending
                                </Badge>
                                <Clock className="h-4 w-4 text-orange-500" />
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalDocuments}</div>
                  <p className="text-xs text-muted-foreground">
                    Kenya government docs
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Processed</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.processedDocuments}</div>
                  <p className="text-xs text-muted-foreground">
                    Ready for search
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Text Chunks</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalChunks.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Searchable segments
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Vector Dimension</CardTitle>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.embeddingDimension}</div>
                  <p className="text-xs text-muted-foreground">
                    Embedding space
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>
                  Document Intelligence Platform Architecture
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-medium">OCR Engine</h4>
                    <p className="text-sm text-muted-foreground">
                      Qwen2.5-VL-7B-Instruct with HuggingFace Inference
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Embedding Model</h4>
                    <p className="text-sm text-muted-foreground">
                      all-MiniLM-L6-v2 (384 dimensions)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Vector Database</h4>
                    <p className="text-sm text-muted-foreground">
                      FAISS IndexFlatL2 for similarity search
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Chunking Strategy</h4>
                    <p className="text-sm text-muted-foreground">
                      Hybrid structural + sliding window (1000 chars, 200 overlap)
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium">Performance Metrics</h4>
                  <div className="grid gap-2 md:grid-cols-3 text-sm">
                    <div>
                      <span className="font-medium">Processing:</span> ~50 pages/15min
                    </div>
                    <div>
                      <span className="font-medium">Search Latency:</span> 20-50ms
                    </div>
                    <div>
                      <span className="font-medium">Accuracy:</span> 95% text extraction
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Subscription Modal */}
        {showSubscriptionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSubscriptionModal(false)}>
            <Card className="w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle className="text-2xl">Premium Plan Required</CardTitle>
                <CardDescription>
                  Upgrade to upload and process custom documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 rounded-lg text-center">
                  <div className="text-5xl font-bold text-primary mb-2">$50,000</div>
                  <div className="text-sm text-muted-foreground">per year</div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">Premium Features:</h3>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Unlimited Document Uploads</p>
                        <p className="text-sm text-muted-foreground">Process custom PDFs with Chandra OCR</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Private Document Processing</p>
                        <p className="text-sm text-muted-foreground">Secure, isolated document intelligence</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">API Access</p>
                        <p className="text-sm text-muted-foreground">Programmatic access to search and upload</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Priority Support</p>
                        <p className="text-sm text-muted-foreground">Dedicated technical assistance</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Custom Integration</p>
                        <p className="text-sm text-muted-foreground">White-label solutions available</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => window.location.href = 'mailto:sales@documentintelligence.co.ke?subject=Premium%20Plan%20Inquiry'}
                  >
                    Contact Sales Team
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowSubscriptionModal(false)}
                  >
                    Continue with Free Plan
                  </Button>
                </div>

                <div className="text-center text-xs text-muted-foreground">
                  <p>Enterprise pricing available for government agencies</p>
                  <p className="mt-1">Volume discounts for multiple departments</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Document Viewer Modal */}
        {documentView && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDocumentView(null)}>
            <Card className="w-full max-w-4xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <CardHeader className="flex-shrink-0 border-b">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {documentView.documentTitle}
                    </CardTitle>
                    {documentView.highlightSection && (
                      <CardDescription>
                        Showing section: {documentView.highlightSection}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDocumentView(null)}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                {isLoadingDocument ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Loading document...</p>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {documentView.content}
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}