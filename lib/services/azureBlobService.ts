import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

let blobServiceClient: BlobServiceClient | null = null;
let containerClient: ContainerClient | null = null;

export function initializeAzureBlob(): ContainerClient | null {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'audio-recordings';

  if (!connectionString) {
    console.warn('AZURE_STORAGE_CONNECTION_STRING is not configured. Audio uploads will be skipped.');
    return null;
  }

  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    containerClient = blobServiceClient.getContainerClient(containerName);
    return containerClient;
  } catch (error) {
    console.error('Failed to initialize Azure Blob Storage:', error);
    return null;
  }
}

export async function ensureContainerExists(): Promise<boolean> {
  if (!containerClient) {
    const client = initializeAzureBlob();
    if (!client) {
      return false;
    }
  }
  
  if (!containerClient) {
    return false;
  }

  try {
    // Create container with private access (no public access)
    // Access will be via SAS tokens only
    await containerClient.createIfNotExists();
    return true;
  } catch (error) {
    console.error('Failed to ensure container exists:', error);
    return false;
  }
}

export async function uploadAudioBlob(
  blobName: string,
  audioBlob: Blob,
  contentType: string = 'audio/webm'
): Promise<string | null> {
  console.log(`[uploadAudioBlob] Starting upload: ${blobName}, size: ${audioBlob.size}, type: ${contentType}`);
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    console.warn('[uploadAudioBlob] AZURE_STORAGE_CONNECTION_STRING is not set. Audio will not be saved.');
    return null;
  }
  const containerReady = await ensureContainerExists();
  if (!containerReady || !containerClient) {
    console.warn('[uploadAudioBlob] Azure container not ready (ensureContainerExists failed or containerClient null). Check connection string and container name.');
    return null;
  }

  try {
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Convert Blob to Buffer for Azure
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[uploadAudioBlob] Converted to buffer: ${buffer.length} bytes`);
    
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType
      }
    });

    const blobUrl = blockBlobClient.url;
    console.log(`[uploadAudioBlob] Upload successful! Blob URL: ${blobUrl}`);
    
    // Return the blob URL (permanent, but requires SAS token for access)
    return blobUrl;
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[uploadAudioBlob] Error uploading audio blob:', err?.message ?? error);
    if (err?.message?.includes('BlobNotFound') || err?.message?.includes('AuthenticationFailed')) {
      console.error('[uploadAudioBlob] Check: connection string, storage account key, and container name (default: audio-recordings).');
    }
    return null;
  }
}

export async function generateSasToken(blobName: string, expiresInHours: number = 24): Promise<string | null> {
  if (!containerClient) {
    const client = initializeAzureBlob();
    if (!client) {
      return null;
    }
  }
  
  if (!containerClient) {
    return null;
  }

  try {
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Generate SAS token with read permissions
    // Using type assertion for permissions as the SDK accepts string but TypeScript types may be strict
    const sasUrl = await blockBlobClient.generateSasUrl({
      permissions: 'r' as any, // Read only - using 'as any' to work around TypeScript type checking
      expiresOn: new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
    });

    return sasUrl;
  } catch (error) {
    console.error('Error generating SAS token:', error);
    return null;
  }
}

export function getBlobUrl(blobName: string): string | null {
  if (!containerClient) {
    const client = initializeAzureBlob();
    if (!client) {
      return null;
    }
  }
  
  if (!containerClient) {
    return null;
  }

  try {
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    return blockBlobClient.url;
  } catch (error) {
    console.error('Error getting blob URL:', error);
    return null;
  }
}
