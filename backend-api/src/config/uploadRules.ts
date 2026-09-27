export interface UploadRule {
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  magicBytes: number[];
  description: string;
}

export const UPLOAD_RULES: Record<string, UploadRule> = {
  pan_card: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46], // %PDF
    description: 'Official PAN Card PDF from Income Tax Department',
  },
  pan: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'Official PAN Card PDF from Income Tax Department',
  },
  gst_certificate: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'GSTIN Registration Certificate PDF from GST Portal',
  },
  gst: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'GSTIN Registration Certificate PDF from GST Portal',
  },
  udyam_certificate: {
    allowedMimeTypes: ['application/pdf', 'application/xml', 'text/xml'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'Udyam/MSME Certificate PDF or DigiLocker XML',
  },
  udyam: {
    allowedMimeTypes: ['application/pdf', 'application/xml', 'text/xml'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'Udyam/MSME Certificate PDF or DigiLocker XML',
  },
  udyam_certificate_pdf: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'Udyam/MSME Certificate PDF',
  },
  udyam_certificate_xml: {
    allowedMimeTypes: ['application/xml', 'text/xml'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x3C, 0x3F, 0x78, 0x6D, 0x6C],
    description: 'DigiLocker/DSC Signed Udyam XML',
  },
  itr_document: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 10 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'Income Tax Return PDF',
  },
  itr: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 10 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'Income Tax Return PDF',
  },
  digilocker_wallet: {
    allowedMimeTypes: ['application/xml', 'text/xml'],
    maxSizeBytes: 2 * 1024 * 1024,
    magicBytes: [0x3C, 0x3F, 0x78, 0x6D, 0x6C], // <?xml
    description: 'DigiLocker signed document XML',
  },
  oem_authorization: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'OEM Authorization Certificate PDF',
  },
  oem: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    description: 'OEM Authorization Certificate PDF',
  },
};


/**
 * Validates file buffer against magic bytes.
 * For XML files: checks for <?xml or <
 * For PDF files: checks for %PDF
 */
export function checkMagicBytes(buffer: Buffer, docType: string, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  // XML check
  if (mimeType.includes('xml') || docType === 'digilocker_wallet') {
    const isXml =
      (buffer[0] === 0x3c && buffer[1] === 0x3f && buffer[2] === 0x78 && buffer[3] === 0x6d) || // <?xm
      buffer[0] === 0x3c; // <
    return isXml;
  }

  // Default PDF check: %PDF (0x25, 0x50, 0x44, 0x46)
  return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
}
