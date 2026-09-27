import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

const outDirs = [
  path.resolve('../bharatbid/public/sample-docs'),
  path.resolve('../test-documents'),
  path.resolve('./demo-assets')
];

for (const d of outDirs) {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
}

async function createPanPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Border & Header
  page.drawRectangle({ x: 40, y: 720, width: 515, height: 80, color: rgb(0.95, 0.96, 0.98), borderColor: rgb(0.1, 0.2, 0.4), borderWidth: 2 });
  page.drawText('GOVERNMENT OF INDIA', { x: 210, y: 770, size: 14, font: bold, color: rgb(0.1, 0.2, 0.4) });
  page.drawText('INCOME TAX DEPARTMENT', { x: 200, y: 750, size: 13, font: bold, color: rgb(0.8, 0.3, 0.1) });
  page.drawText('PERMANENT ACCOUNT NUMBER CARD', { x: 175, y: 730, size: 11, font: bold, color: rgb(0.15, 0.15, 0.15) });

  // Fields Table
  const drawRow = (label, val, y) => {
    page.drawText(label, { x: 60, y, size: 10, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(val, { x: 220, y, size: 11, font, color: rgb(0.05, 0.05, 0.05) });
  };

  page.drawRectangle({ x: 40, y: 460, width: 515, height: 240, color: rgb(1, 1, 1), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
  drawRow('Permanent Account Number (PAN):', 'AAWBS9999P', 670);
  drawRow('Entity Legal Name:', 'Ananya Enterprises Pvt Ltd', 635);
  drawRow('Father / Authorized Signatory:', 'Rajesh Verma', 600);
  drawRow('Date of Incorporation / Birth:', '15/06/1984', 565);
  drawRow('Jurisdiction & Assessing Officer:', 'WARD 14(2)(1), MUMBAI', 530);
  drawRow('Status of Entity:', 'Company / Registered Enterprise', 495);

  // Digital Signature Box
  page.drawRectangle({ x: 40, y: 350, width: 515, height: 90, color: rgb(0.93, 0.97, 0.93), borderColor: rgb(0.2, 0.6, 0.2), borderWidth: 1.5 });
  page.drawText('DIGITALLY SIGNED & VERIFIED BY INCOME TAX AUTHORITIES', { x: 60, y: 415, size: 10, font: bold, color: rgb(0.15, 0.5, 0.15) });
  page.drawText('Signer: e-Mudhra Signer (Tax Authorities of India)', { x: 60, y: 395, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Trusted CA: e-Mudhra Sub-CA for Government Tax Portals', { x: 60, y: 380, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Signature Digest: a3f8c2b190d47e11c6d32849e7b23c91 · Validated via Sovereign Trust Store', { x: 60, y: 365, size: 8, font, color: rgb(0.4, 0.4, 0.4) });

  const bytes = await pdfDoc.save();
  return bytes;
}

async function createGstPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 40, y: 720, width: 515, height: 80, color: rgb(0.96, 0.95, 0.98), borderColor: rgb(0.2, 0.15, 0.45), borderWidth: 2 });
  page.drawText('GOODS AND SERVICES TAX NETWORK (GSTN)', { x: 155, y: 765, size: 13, font: bold, color: rgb(0.15, 0.1, 0.4) });
  page.drawText('REGISTRATION CERTIFICATE (Form GST REG-06)', { x: 160, y: 745, size: 11, font: bold, color: rgb(0.8, 0.35, 0.1) });
  page.drawText('Government of Maharashtra · State Tax Department', { x: 180, y: 730, size: 9, font, color: rgb(0.3, 0.3, 0.3) });

  const drawRow = (label, val, y) => {
    page.drawText(label, { x: 60, y, size: 10, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(val, { x: 220, y, size: 11, font, color: rgb(0.05, 0.05, 0.05) });
  };

  page.drawRectangle({ x: 40, y: 440, width: 515, height: 260, color: rgb(1, 1, 1), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
  drawRow('GSTIN / Registration Number:', '27AAWBS9999P1Z5', 665);
  drawRow('Legal Name:', 'Ananya Enterprises Pvt Ltd', 630);
  drawRow('Trade Name:', 'Ananya Tech Innovations', 595);
  drawRow('Constitution of Business:', 'Private Limited Company', 560);
  drawRow('Principal Place of Business:', 'Andheri East, Mumbai, Maharashtra - 400069', 525);
  drawRow('Date of Validity / Registration:', '20/08/2021 (Active Status)', 490);
  drawRow('Type of Registration:', 'Regular Taxpayer', 455);

  page.drawRectangle({ x: 40, y: 340, width: 515, height: 85, color: rgb(0.93, 0.97, 0.93), borderColor: rgb(0.2, 0.6, 0.2), borderWidth: 1.5 });
  page.drawText('DIGITALLY SIGNED & VERIFIED BY GSTN SIFY SAFESCRYPT CA', { x: 60, y: 405, size: 10, font: bold, color: rgb(0.15, 0.5, 0.15) });
  page.drawText('Signer: GSTN Sify Safescrypt Signing Authority', { x: 60, y: 388, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Cert Chain: Sify Safescrypt CA (Mock) -> CCA Root 2026', { x: 60, y: 373, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Signature Digest: b4a9d3e218c50f229871a2c3d4e5f678 · Valid via National Trust Registry', { x: 60, y: 358, size: 8, font, color: rgb(0.4, 0.4, 0.4) });

  const bytes = await pdfDoc.save();
  return bytes;
}

async function createUdyamPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 40, y: 720, width: 515, height: 80, color: rgb(0.98, 0.96, 0.92), borderColor: rgb(0.7, 0.4, 0.1), borderWidth: 2 });
  page.drawText('MINISTRY OF MICRO, SMALL & MEDIUM ENTERPRISES', { x: 135, y: 765, size: 12, font: bold, color: rgb(0.7, 0.35, 0.05) });
  page.drawText('UDYAM REGISTRATION CERTIFICATE', { x: 185, y: 745, size: 12, font: bold, color: rgb(0.1, 0.2, 0.4) });
  page.drawText('MSME Development Act, 2006 · Government of India', { x: 185, y: 730, size: 9, font, color: rgb(0.3, 0.3, 0.3) });

  const drawRow = (label, val, y) => {
    page.drawText(label, { x: 60, y, size: 10, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(val, { x: 220, y, size: 11, font, color: rgb(0.05, 0.05, 0.05) });
  };

  page.drawRectangle({ x: 40, y: 440, width: 515, height: 260, color: rgb(1, 1, 1), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
  drawRow('Udyam Registration Number:', 'UDYAM-MH-01-00892', 665);
  drawRow('Name of Enterprise:', 'Ananya Enterprises Pvt Ltd', 630);
  drawRow('Major Activity:', 'Manufacturing & Technical Solutions', 595);
  drawRow('Enterprise Classification:', 'Micro Enterprise', 560);
  drawRow('National Industry Classification (NIC):', '2620 - Manufacture of computing machinery', 525);
  drawRow('Date of Incorporation:', '15/06/1984', 490);
  drawRow('MSME Sub-Category:', 'Exempted from EMD under GeM Procurement', 455);

  page.drawRectangle({ x: 40, y: 340, width: 515, height: 85, color: rgb(0.93, 0.97, 0.93), borderColor: rgb(0.2, 0.6, 0.2), borderWidth: 1.5 });
  page.drawText('DIGITALLY SIGNED VIA NATIONAL INFORMATICS CENTRE (NIC)', { x: 60, y: 405, size: 10, font: bold, color: rgb(0.15, 0.5, 0.15) });
  page.drawText('Signer: NIC-CA (DigiLocker Issuing Authority)', { x: 60, y: 388, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('DigiLocker URI: in.gov.msme.udyam-cert-00892-signed', { x: 60, y: 373, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Signature Digest: c7d8e9f012a34b568910fedcba987654 · Cryptographic Proof Valid', { x: 60, y: 358, size: 8, font, color: rgb(0.4, 0.4, 0.4) });

  const bytes = await pdfDoc.save();
  return bytes;
}

async function createItrPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 40, y: 720, width: 515, height: 80, color: rgb(0.95, 0.97, 0.99), borderColor: rgb(0.1, 0.3, 0.5), borderWidth: 2 });
  page.drawText('CENTRAL BOARD OF DIRECT TAXES', { x: 195, y: 765, size: 13, font: bold, color: rgb(0.1, 0.25, 0.45) });
  page.drawText('INDIAN INCOME TAX RETURN ACKNOWLEDGEMENT (ITR-V)', { x: 130, y: 745, size: 11, font: bold, color: rgb(0.8, 0.3, 0.1) });
  page.drawText('Assessment Year 2024-25 · Section 139, Income Tax Act, 1961', { x: 165, y: 730, size: 9, font, color: rgb(0.3, 0.3, 0.3) });

  const drawRow = (label, val, y) => {
    page.drawText(label, { x: 60, y, size: 10, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(val, { x: 220, y, size: 11, font, color: rgb(0.05, 0.05, 0.05) });
  };

  page.drawRectangle({ x: 40, y: 440, width: 515, height: 260, color: rgb(1, 1, 1), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
  drawRow('PAN:', 'AAWBS9999P', 665);
  drawRow('Name of Assessee:', 'Ananya Enterprises Pvt Ltd', 630);
  drawRow('Filing Status & Form:', 'ITR-4 / E-Filed Successfully', 595);
  drawRow('Acknowledgement Number:', '981245012849102', 560);
  drawRow('Gross Total Income:', 'INR 45,00,000 (Forty-Five Lakhs Only)', 525);
  drawRow('Total Taxes Paid:', 'INR 6,80,000 (Challan BSR Verified)', 490);
  drawRow('Date of Filing & e-Verification:', '10/07/2026 (Verified via Aadhaar OTP)', 455);

  page.drawRectangle({ x: 40, y: 340, width: 515, height: 85, color: rgb(0.97, 0.97, 0.97), borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 1 });
  page.drawText('E-VERIFIED SUBMISSION VIA CBDT E-FILING PORTAL', { x: 60, y: 405, size: 10, font: bold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Status: Electronically verified without manual physical signature.', { x: 60, y: 388, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('Authentication Mode: EVC / Aadhaar OTP Token Authenticated', { x: 60, y: 373, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('Transaction ID: 2024-ITR-AAWBS9999P-98124 · Ready for GeM Turnover Validation', { x: 60, y: 358, size: 8, font, color: rgb(0.4, 0.4, 0.4) });

  const bytes = await pdfDoc.save();
  return bytes;
}

async function createDebarmentAffidavitPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 40, y: 720, width: 515, height: 80, color: rgb(0.98, 0.98, 0.98), borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 2 });
  page.drawText('STATUTORY NON-BLACKLISTING & DEBARMENT UNDERTAKING', { x: 105, y: 765, size: 11, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText('Government e-Marketplace (GeM) Procurement Standard Form', { x: 145, y: 745, size: 10, font: bold, color: rgb(0.6, 0.25, 0.1) });
  page.drawText('Clause 17 of General Financial Rules (GFR), 2017', { x: 185, y: 730, size: 9, font, color: rgb(0.3, 0.3, 0.3) });

  const drawRow = (label, val, y) => {
    page.drawText(label, { x: 60, y, size: 10, font: bold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(val, { x: 220, y, size: 11, font, color: rgb(0.05, 0.05, 0.05) });
  };

  page.drawRectangle({ x: 40, y: 440, width: 515, height: 260, color: rgb(1, 1, 1), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
  drawRow('Deponent / Declarant Name:', 'Rajesh Verma (Managing Director)', 665);
  drawRow('Enterprise Name & PAN:', 'Ananya Enterprises Pvt Ltd (AAWBS9999P)', 630);
  drawRow('Declaration of Non-Debarment:', 'CONFIRMED: Not debarred by any Ministry/GeM', 595);
  drawRow('Anti-Cartelization Pledge:', 'Strict adherence to Competition Act, 2002', 560);
  drawRow('Local Value Addition (MII):', 'Greater than 50% Domestic Content Verified', 525);
  drawRow('Execution Date & Place:', '01/09/2026 · Mumbai, Maharashtra', 490);
  drawRow('Attestation Authority:', 'Notary Public, Govt of Maharashtra', 455);

  page.drawRectangle({ x: 40, y: 340, width: 515, height: 85, color: rgb(0.93, 0.97, 0.93), borderColor: rgb(0.2, 0.6, 0.2), borderWidth: 1.5 });
  page.drawText('DIGITALLY SIGNED VIA CLASS-3 ORGANIZATIONAL DSC', { x: 60, y: 405, size: 10, font: bold, color: rgb(0.15, 0.5, 0.15) });
  page.drawText('Signer: Rajesh Verma (Authorized Representative)', { x: 60, y: 388, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Issuer: e-Mudhra Class 3 Individual and Organization CA', { x: 60, y: 373, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Signature Digest: f8e7d6c5b4a392817012abcdef012345 · Valid & Untampered', { x: 60, y: 358, size: 8, font, color: rgb(0.4, 0.4, 0.4) });

  const bytes = await pdfDoc.save();
  return bytes;
}

async function createTamperedPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 40, y: 720, width: 515, height: 80, color: rgb(0.99, 0.92, 0.92), borderColor: rgb(0.8, 0.2, 0.2), borderWidth: 2 });
  page.drawText('TAMPERED TEST DOCUMENT - NEGATIVE TEST CASE', { x: 125, y: 765, size: 12, font: bold, color: rgb(0.8, 0.1, 0.1) });
  page.drawText('FOR TESTING SECURITY VERIFICATION & DIGITAL SIGNATURE REJECTION', { x: 95, y: 745, size: 9, font: bold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Intentionally modified bytes post-signing to trigger Tampering Flag', { x: 140, y: 730, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

  page.drawRectangle({ x: 40, y: 460, width: 515, height: 240, color: rgb(1, 1, 1), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
  page.drawText('Mismatched Entity: Shell Enterprise Fake Ltd', { x: 60, y: 660, size: 11, font: bold, color: rgb(0.8, 0.1, 0.1) });
  page.drawText('Invalid PAN: XX99999999 (Invalid Checksum)', { x: 60, y: 625, size: 11, font, color: rgb(0.8, 0.1, 0.1) });
  page.drawText('Status: Injected byte sequences altering original document hash.', { x: 60, y: 590, size: 10, font, color: rgb(0.3, 0.3, 0.3) });

  page.drawRectangle({ x: 40, y: 350, width: 515, height: 85, color: rgb(0.99, 0.92, 0.92), borderColor: rgb(0.8, 0.2, 0.2), borderWidth: 1.5 });
  page.drawText('SIGNATURE DIGEST MISMATCH — TAMPERING INTENTIONALLY SIMULATED', { x: 60, y: 405, size: 10, font: bold, color: rgb(0.8, 0.1, 0.1) });
  page.drawText('The backend cryptographic verifier detects altered hash vs signed attribute.', { x: 60, y: 388, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('Expected Result in Portal: Signature Invalid — Tampering Detected (Red Alert Banner).', { x: 60, y: 370, size: 9, font: bold, color: rgb(0.8, 0.1, 0.1) });

  const bytes = await pdfDoc.save();
  return bytes;
}

async function run() {
  console.log('Generating official mock PDFs...');
  const files = {
    'PAN_Card_IncomeTax_AAWBS9999P.pdf': await createPanPdf(),
    'GST_Certificate_27AAWBS9999P1Z5.pdf': await createGstPdf(),
    'Udyam_Registration_Certificate_UDYAM-MH-01-00892.pdf': await createUdyamPdf(),
    'ITR_V_Acknowledgement_AY2024-25.pdf': await createItrPdf(),
    'Debarment_Non_Blacklisting_Declaration.pdf': await createDebarmentAffidavitPdf(),
    'sample_tampered_document.pdf': await createTamperedPdf(),
    'sample_pan_signed.pdf': await createPanPdf(),
    'sample_gst_signed.pdf': await createGstPdf(),
    'sample_tampered.pdf': await createTamperedPdf(),
  };

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<UdyamRegistration xmlns="http://udyamregistration.gov.in/schema/v1">
  <Enterprise>
    <UdyamNumber>UDYAM-MH-01-00892</UdyamNumber>
    <EnterpriseName>Ananya Enterprises Pvt Ltd</EnterpriseName>
    <MajorActivity>Manufacturing</MajorActivity>
    <Category>Micro</Category>
    <NICCode>2620</NICCode>
    <IncorporationDate>1984-06-15</IncorporationDate>
    <PAN>AAWBS9999P</PAN>
  </Enterprise>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <Reference URI="">
        <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <DigestValue>a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>MOCK_NIC_DIGILOCKER_SIGNATURE_VALUE_VALID</SignatureValue>
  </Signature>
</UdyamRegistration>`;

  for (const [filename, content] of Object.entries(files)) {
    for (const d of outDirs) {
      fs.writeFileSync(path.join(d, filename), content);
    }
    console.log(`✓ Wrote ${filename}`);
  }

  for (const d of outDirs) {
    fs.writeFileSync(path.join(d, 'sample_udyam_signed_digilocker.xml'), xmlContent, 'utf8');
  }
  console.log('✓ Wrote sample_udyam_signed_digilocker.xml');
  console.log('All mock documents generated successfully in all directories.');
}

run().catch(console.error);
