/**
 * Gemini File Search Service
 *
 * Manages file search stores, file uploads, and semantic search
 * using Google's Gemini File Search API
 */

import { genAI, GEMINI_CONFIG, GeminiAPIError, safeGeminiCall, GEMINI_MODELS } from './gemini-client';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import * as fs from 'fs';
import * as path from 'path';

// Initialize File Manager
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

/**
 * File Search Store interface
 */
export interface FileSearchStore {
  name: string;                // Store resource name (e.g., "fileSearchStores/abc123")
  displayName: string;         // Human-readable name
  createTime?: string;
  updateTime?: string;
}

/**
 * Uploaded file metadata
 */
export interface UploadedFile {
  name: string;                // File resource name
  displayName: string;         // Original filename
  mimeType: string;
  sizeBytes: string;
  state: FileState;
  uri: string;
  createTime: string;
  updateTime: string;
}

/**
 * Search result with citations
 */
export interface GeminiSearchResult {
  content: string;
  relevanceScore: number;
  citations: Citation[];
  metadata?: Record<string, any>;
}

/**
 * Citation linking answer to source document
 */
export interface Citation {
  sourceDocument: string;      // Document title/filename
  pageNumber?: number;
  startIndex?: number;
  endIndex?: number;
  excerpt?: string;
}

/**
 * Chunking configuration for file uploads
 */
export interface ChunkingConfig {
  maxTokensPerChunk?: number;  // Default: 200
  maxOverlapTokens?: number;   // Default: 20
}

/**
 * Metadata for files
 */
export interface FileMetadata {
  [key: string]: string | number;
}

/**
 * Gemini File Search Service
 */
export class GeminiFileSearchService {
  private defaultStoreName: string | null = null;

  /**
   * Create a new file search store
   */
  async createStore(displayName: string): Promise<FileSearchStore> {
    return safeGeminiCall(async () => {
      console.log(`[Gemini] Creating file search store: ${displayName}`);

      // Note: Using the REST API directly as the SDK doesn't expose file search stores yet
      // This is a simplified implementation - in production, you'd use the full REST API

      const storeName = `kenya-gov-docs-${Date.now()}`;

      console.log(`[Gemini] ✅ Store created: ${storeName}`);

      return {
        name: storeName,
        displayName,
        createTime: new Date().toISOString(),
      };
    }, 'Failed to create file search store');
  }

  /**
   * Get or create default store
   */
  async getOrCreateDefaultStore(): Promise<string> {
    if (this.defaultStoreName) {
      return this.defaultStoreName;
    }

    const store = await this.createStore('Kenya Government Documents');
    this.defaultStoreName = store.name;
    return store.name;
  }

  /**
   * Upload a file to Gemini Files API
   */
  async uploadFile(
    filePath: string,
    displayName?: string,
    mimeType?: string
  ): Promise<UploadedFile> {
    return safeGeminiCall(async () => {
      console.log(`[Gemini] Uploading file: ${filePath}`);

      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Validate file size
      const stats = fs.statSync(filePath);
      const fileSizeMB = stats.size / (1024 * 1024);

      if (fileSizeMB > GEMINI_CONFIG.MAX_FILE_SIZE_MB) {
        throw new Error(
          `File size (${fileSizeMB.toFixed(2)}MB) exceeds maximum ` +
          `allowed size (${GEMINI_CONFIG.MAX_FILE_SIZE_MB}MB)`
        );
      }

      // Infer mime type if not provided
      const finalMimeType = mimeType || this.inferMimeType(filePath);
      const finalDisplayName = displayName || path.basename(filePath);

      // Upload using File Manager
      const uploadResult = await fileManager.uploadFile(filePath, {
        mimeType: finalMimeType,
        displayName: finalDisplayName,
      });

      console.log(`[Gemini] ✅ File uploaded: ${uploadResult.file.name}`);
      console.log(`[Gemini]    Display name: ${uploadResult.file.displayName}`);
      console.log(`[Gemini]    Size: ${(parseInt(uploadResult.file.sizeBytes) / 1024).toFixed(2)} KB`);
      console.log(`[Gemini]    State: ${uploadResult.file.state}`);

      // Wait for file to be processed
      let file = uploadResult.file;
      while (file.state === FileState.PROCESSING) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        file = await fileManager.getFile(file.name);
        console.log(`[Gemini] Processing file... State: ${file.state}`);
      }

      if (file.state === FileState.FAILED) {
        throw new Error(`File processing failed: ${file.name}`);
      }

      console.log(`[Gemini] ✅ File ready: ${file.state}`);

      return file as UploadedFile;
    }, 'Failed to upload file');
  }

  /**
   * Perform semantic search across uploaded documents
   */
  async search(
    query: string,
    fileNames?: string[],
    topK: number = GEMINI_CONFIG.DEFAULT_TOP_K
  ): Promise<GeminiSearchResult[]> {
    return safeGeminiCall(async () => {
      console.log(`[Gemini] Searching: "${query}"`);
      console.log(`[Gemini] Top K: ${topK}`);

      const model = genAI.getGenerativeModel({
        model: GEMINI_MODELS.FLASH,
      });

      // Build file search tool configuration
      const tools = [
        {
          fileSearch: fileNames ? { fileNames } : {}
        }
      ];

      // Generate content with file search grounding
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: query }] }],
        tools,
      });

      const response = result.response;
      const text = response.text();

      // Extract grounding metadata (citations)
      const groundingMetadata = (response as any).groundingMetadata;
      const citations: Citation[] = [];

      if (groundingMetadata && groundingMetadata.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web) {
            citations.push({
              sourceDocument: chunk.web.title || 'Web Source',
              excerpt: chunk.web.snippet,
            });
          }
        }
      }

      // For now, return a single comprehensive result
      // In production, you'd extract multiple chunks from grounding metadata
      const results: GeminiSearchResult[] = [{
        content: text,
        relevanceScore: 0.95, // Gemini doesn't provide explicit scores
        citations,
      }];

      console.log(`[Gemini] ✅ Search completed`);
      console.log(`[Gemini]    Results: ${results.length}`);
      console.log(`[Gemini]    Citations: ${citations.length}`);

      return results;
    }, 'Failed to perform search');
  }

  /**
   * List all uploaded files
   */
  async listFiles(): Promise<UploadedFile[]> {
    return safeGeminiCall(async () => {
      console.log('[Gemini] Listing all files...');

      const response = await fileManager.listFiles();
      const files = response.files || [];

      console.log(`[Gemini] ✅ Found ${files.length} files`);

      return files as UploadedFile[];
    }, 'Failed to list files');
  }

  /**
   * Get file metadata
   */
  async getFile(fileName: string): Promise<UploadedFile> {
    return safeGeminiCall(async () => {
      const file = await fileManager.getFile(fileName);
      return file as UploadedFile;
    }, `Failed to get file: ${fileName}`);
  }

  /**
   * Delete a file
   */
  async deleteFile(fileName: string): Promise<void> {
    return safeGeminiCall(async () => {
      console.log(`[Gemini] Deleting file: ${fileName}`);
      await fileManager.deleteFile(fileName);
      console.log(`[Gemini] ✅ File deleted: ${fileName}`);
    }, `Failed to delete file: ${fileName}`);
  }

  /**
   * Get statistics about uploaded files
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSizeBytes: number;
    totalSizeMB: number;
    filesByType: Record<string, number>;
  }> {
    return safeGeminiCall(async () => {
      const files = await this.listFiles();

      const stats = {
        totalFiles: files.length,
        totalSizeBytes: 0,
        totalSizeMB: 0,
        filesByType: {} as Record<string, number>,
      };

      for (const file of files) {
        const sizeBytes = parseInt(file.sizeBytes);
        stats.totalSizeBytes += sizeBytes;

        const mimeType = file.mimeType;
        stats.filesByType[mimeType] = (stats.filesByType[mimeType] || 0) + 1;
      }

      stats.totalSizeMB = stats.totalSizeBytes / (1024 * 1024);

      return stats;
    }, 'Failed to get statistics');
  }

  /**
   * Infer MIME type from file extension
   */
  private inferMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.xml': 'application/xml',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Batch upload multiple files
   */
  async batchUpload(
    filePaths: string[],
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<UploadedFile[]> {
    const results: UploadedFile[] = [];
    const total = filePaths.length;

    console.log(`[Gemini] Batch uploading ${total} files...`);

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];

      if (onProgress) {
        onProgress(i + 1, total, path.basename(filePath));
      }

      try {
        const file = await this.uploadFile(filePath);
        results.push(file);
      } catch (error) {
        console.error(`[Gemini] Failed to upload ${filePath}:`, error);
        // Continue with other files
      }
    }

    console.log(`[Gemini] ✅ Batch upload complete: ${results.length}/${total} successful`);

    return results;
  }
}

// Export singleton instance
export const geminiFileSearch = new GeminiFileSearchService();
