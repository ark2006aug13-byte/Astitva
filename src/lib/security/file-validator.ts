import crypto from 'crypto';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 Megabytes

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  detectedMimeType?: AllowedMimeType;
  sha256Hash: string;
  sizeBytes: number;
}

/**
 * Validates file buffer against size constraints, allowed extensions,
 * and magic byte signatures to prevent file extension spoofing attacks.
 */
export function validateResumeBuffer(
  buffer: Buffer,
  fileName?: string,
  declaredMimeType?: string
): FileValidationResult {
  const sizeBytes = buffer.length;
  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Check 1: Size Limit
  if (sizeBytes === 0) {
    return {
      isValid: false,
      error: 'File is empty (0 bytes).',
      sha256Hash,
      sizeBytes,
    };
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size (${(sizeBytes / (1024 * 1024)).toFixed(2)}MB) exceeds the maximum limit of 5MB.`,
      sha256Hash,
      sizeBytes,
    };
  }

  // Check 2: Magic Byte Header Inspection
  // PDF Header: %PDF- (25 50 44 46)
  const isPdf =
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46;

  // DOCX Header (PK Zip): PK\x03\x04 (50 4B 03 04)
  const isDocx =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (!isPdf && !isDocx) {
    return {
      isValid: false,
      error: 'Invalid file signature. Only valid PDF (%PDF-) and DOCX (PK ZIP) documents are permitted.',
      sha256Hash,
      sizeBytes,
    };
  }

  const detectedMimeType: AllowedMimeType = isPdf
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  // Check 3: If declared extension or MIME type contradicts magic bytes
  if (fileName) {
    const lowerName = fileName.toLowerCase();
    if (isPdf && !lowerName.endsWith('.pdf')) {
      return {
        isValid: false,
        error: 'File content is PDF, but file extension does not match (.pdf required).',
        sha256Hash,
        sizeBytes,
      };
    }
    if (isDocx && !lowerName.endsWith('.docx')) {
      return {
        isValid: false,
        error: 'File content is DOCX, but file extension does not match (.docx required).',
        sha256Hash,
        sizeBytes,
      };
    }
  }

  return {
    isValid: true,
    detectedMimeType,
    sha256Hash,
    sizeBytes,
  };
}
