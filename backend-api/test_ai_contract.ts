import { extractDocumentData } from './src/services/aiExtraction.js';

async function main() {
  const sampleDoc = "M/s Acme Enterprises. PAN: AABCP7890F. GSTIN: 33AABCP7890F1Z6. UDYAM-DL-01-0012345.";
  const extracted = await extractDocumentData(sampleDoc, 'sample.txt');
  console.log('AI_SUCCESS:' + JSON.stringify(extracted));

  try {
    await extractDocumentData('CORRUPT_DOCUMENT_DATA_BINARY_TRASH', 'corrupt.bin');
    console.log('AI_FAIL:did not throw');
  } catch (err: any) {
    console.log('AI_CORRUPT_HANDLED:' + err.name);
  }
}

main();
