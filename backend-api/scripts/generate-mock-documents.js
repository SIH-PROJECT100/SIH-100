import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
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

// Helper: draw authentic simulated QR code
function drawSimulatedQr(page, x, y, size = 68) {
  // Background white box
  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 1,
  });

  const drawFinder = (fx, fy) => {
    page.drawRectangle({ x: fx, y: fy, width: 16, height: 16, color: rgb(0.1, 0.1, 0.1) });
    page.drawRectangle({ x: fx + 3, y: fy + 3, width: 10, height: 10, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: fx + 5, y: fy + 5, width: 6, height: 6, color: rgb(0.1, 0.1, 0.1) });
  };

  // 3 Finder patterns
  drawFinder(x + 4, y + size - 20); // Top-left
  drawFinder(x + size - 20, y + size - 20); // Top-right
  drawFinder(x + 4, y + 4); // Bottom-left

  // Random data matrix dots
  const step = 4;
  const seed = [
    [1,0,1,1,0,1,0,1],
    [0,1,0,0,1,0,1,0],
    [1,1,0,1,1,0,0,1],
    [0,0,1,0,1,1,0,1],
    [1,0,1,0,0,1,1,0],
    [0,1,1,1,0,0,1,1],
  ];

  for (let r = 0; r < seed.length; r++) {
    for (let c = 0; c < seed[r].length; c++) {
      if (seed[r][c] === 1) {
        page.drawRectangle({
          x: x + 24 + c * 4.5,
          y: y + 8 + r * 6,
          width: 3.5,
          height: 3.5,
          color: rgb(0.15, 0.15, 0.15),
        });
      }
    }
  }
}

// Helper: draw authentic simulated Barcode
function drawSimulatedBarcode(page, font, x, y, width, height, codeText) {
  const pattern = [2, 1, 3, 1, 1, 2, 3, 2, 1, 2, 1, 3, 2, 1, 1, 3, 2, 2, 1, 1, 2, 3, 1, 2, 1, 3, 1, 1, 2, 2, 3, 1, 2, 1];
  let currX = x;
  let bar = true;
  for (const w of pattern) {
    if (bar && currX < x + width) {
      page.drawRectangle({
        x: currX,
        y: y + 10,
        width: Math.min(w, x + width - currX),
        height: height - 10,
        color: rgb(0.1, 0.1, 0.1),
      });
    }
    currX += w + 1;
    bar = !bar;
  }
  page.drawText(codeText, {
    x: x + (width - codeText.length * 5) / 2,
    y: y,
    size: 7.5,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
}

// Helper: draw Sovereign Indian Government Page Frame & Watermarks
function applyGovTemplate(page, font, bold, options = {}) {
  const { width, height } = page.getSize();
  const { isTampered = false } = options;

  // Outer ornate double border
  const borderMargin = 22;
  page.drawRectangle({
    x: borderMargin,
    y: borderMargin,
    width: width - borderMargin * 2,
    height: height - borderMargin * 2,
    borderColor: isTampered ? rgb(0.8, 0.2, 0.2) : rgb(0.08, 0.18, 0.32),
    borderWidth: 2,
    color: rgb(0.995, 0.995, 0.992),
  });

  page.drawRectangle({
    x: borderMargin + 4,
    y: borderMargin + 4,
    width: width - (borderMargin + 4) * 2,
    height: height - (borderMargin + 4) * 2,
    borderColor: isTampered ? rgb(0.9, 0.4, 0.4) : rgb(0.78, 0.65, 0.4),
    borderWidth: 0.75,
  });

  // Tricolor Top Strip (Saffron, White, Green)
  const stripY = height - borderMargin - 5;
  page.drawRectangle({ x: borderMargin + 5, y: stripY, width: (width - borderMargin * 2 - 10) / 3, height: 3, color: rgb(0.93, 0.45, 0.1) });
  page.drawRectangle({ x: borderMargin + 5 + (width - borderMargin * 2 - 10) / 3, y: stripY, width: (width - borderMargin * 2 - 10) / 3, height: 3, color: rgb(0.95, 0.95, 0.95) });
  page.drawRectangle({ x: borderMargin + 5 + 2 * (width - borderMargin * 2 - 10) / 3, y: stripY, width: (width - borderMargin * 2 - 10) / 3, height: 3, color: rgb(0.08, 0.55, 0.2) });

  // Top SPECIMEN DEMO Banner
  page.drawRectangle({
    x: borderMargin + 8,
    y: height - 44,
    width: width - (borderMargin + 8) * 2,
    height: 16,
    color: isTampered ? rgb(1, 0.92, 0.92) : rgb(1, 0.96, 0.88),
    borderColor: isTampered ? rgb(0.85, 0.2, 0.2) : rgb(0.85, 0.45, 0.1),
    borderWidth: 1,
  });

  const bannerText = isTampered
    ? '[ DEMO NEGATIVE TEST CASE * TAMPERED SPECIMEN * NOT FOR PRODUCTION USE ]'
    : '[ DEMO SPECIMEN * EVALUATION COPY FOR GE-MARKETPLACE SIH 2026 * NOT FOR LEGAL USE ]';

  page.drawText(bannerText, {
    x: 82,
    y: height - 38,
    size: 8,
    font: bold,
    color: isTampered ? rgb(0.8, 0.1, 0.1) : rgb(0.65, 0.25, 0.05),
  });

  // Large Diagonal DEMO Watermark across the page
  const wmColor = isTampered ? rgb(0.85, 0.2, 0.2) : rgb(0.75, 0.3, 0.1);
  page.drawText('DEMO SPECIMEN - FOR EVALUATION ONLY', {
    x: 75,
    y: 350,
    size: 27,
    font: bold,
    color: wmColor,
    opacity: 0.16,
    rotate: degrees(38),
  });

  page.drawText('SMART INDIA HACKATHON 2026 - NOT FOR STATUTORY USE', {
    x: 100,
    y: 280,
    size: 16,
    font: bold,
    color: wmColor,
    opacity: 0.14,
    rotate: degrees(38),
  });

  // Bottom Footer Disclaimer
  page.drawLine({
    start: { x: borderMargin + 10, y: 44 },
    end: { x: width - borderMargin - 10, y: 44 },
    thickness: 0.75,
    color: rgb(0.75, 0.75, 0.75),
  });

  page.drawText('OFFICIAL DEMO DOCUMENT CREATED FOR VERIFIABLE TRUST LEDGER EVALUATION - GE-MARKETPLACE (GeM)', {
    x: 52,
    y: 32,
    size: 7.5,
    font: bold,
    color: rgb(0.35, 0.35, 0.35),
  });

  page.drawText('This certificate is generated for demonstration and testing of digital signature validation and compliance triage.', {
    x: 70,
    y: 22,
    size: 6.5,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
}

// Helper: draw Digital Signature / Certificate Block
function drawDigitalSignatureBlock(page, font, bold, { x, y, width, height, title, signer, certPath, hash, validDate }) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(0.94, 0.98, 0.94),
    borderColor: rgb(0.18, 0.58, 0.25),
    borderWidth: 1.5,
  });

  // Simulated Seal / Checkmark Icon
  page.drawCircle({ x: x + 24, y: y + height / 2, size: 14, color: rgb(0.18, 0.58, 0.25) });
  page.drawText('OK', { x: x + 17, y: y + height / 2 - 4, size: 9, font: bold, color: rgb(1, 1, 1) });

  page.drawText(title, { x: x + 46, y: y + height - 16, size: 9.5, font: bold, color: rgb(0.12, 0.45, 0.18) });
  page.drawText(`Signer: ${signer}`, { x: x + 46, y: y + height - 28, size: 8, font, color: rgb(0.15, 0.15, 0.15) });
  page.drawText(`CA Chain: ${certPath}`, { x: x + 46, y: y + height - 40, size: 7.5, font, color: rgb(0.25, 0.25, 0.25) });
  page.drawText(`Digital Digest (SHA-256): ${hash}`, { x: x + 46, y: y + height - 52, size: 7, font, color: rgb(0.35, 0.35, 0.35) });
  page.drawText(`Timestamp & Validity: ${validDate} | Validated against Sovereign Root Store`, { x: x + 46, y: y + height - 63, size: 6.8, font, color: rgb(0.3, 0.5, 0.3) });
}

// 1. PAN Card & Verification Certificate
async function createPanPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  applyGovTemplate(page, font, bold);

  // Government Emblem & Department Header Box
  page.drawRectangle({
    x: 36,
    y: 710,
    width: 523,
    height: 82,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.12, 0.22, 0.4),
    borderWidth: 1.5,
  });

  page.drawText('[ SATYAMEVA JAYATE ]', { x: 235, y: 775, size: 9, font: bold, color: rgb(0.4, 0.2, 0.1) });
  page.drawText('GOVERNMENT OF INDIA (BHARAT SARKAR)', { x: 175, y: 760, size: 12, font: bold, color: rgb(0.1, 0.2, 0.4) });
  page.drawText('INCOME TAX DEPARTMENT (AYAKAR VIBHAG)', { x: 170, y: 742, size: 11, font: bold, color: rgb(0.8, 0.3, 0.05) });
  page.drawText('PERMANENT ACCOUNT NUMBER CARD VERIFICATION RECORD (FORM NO. 49A)', { x: 105, y: 724, size: 8.5, font: bold, color: rgb(0.2, 0.2, 0.2) });

  // Barcode & QR Code Top Strip
  drawSimulatedBarcode(page, font, 44, 650, 160, 42, '*AAWBS9999P*');
  drawSimulatedQr(page, 480, 638, 64);
  page.drawText('Scan to verify on CBDT Portal', { x: 460, y: 627, size: 6, font, color: rgb(0.4, 0.4, 0.4) });

  page.drawText('VERIFIED TAXPAYER IDENTITY PROFILE', { x: 40, y: 605, size: 11, font: bold, color: rgb(0.1, 0.22, 0.42) });

  // Grid Table
  page.drawRectangle({
    x: 36,
    y: 350,
    width: 523,
    height: 245,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.75, 0.75, 0.8),
    borderWidth: 1,
  });

  const headers = [
    { label: 'Permanent Account Number (PAN)', value: 'AAWBS9999P', status: 'ACTIVE & ALLOTTED' },
    { label: 'Full Legal Entity Name', value: 'Ananya Enterprises Pvt Ltd', status: 'VERIFIED (MCA-21 MATCH)' },
    { label: 'Authorized Signatory / Father', value: 'Rajesh Verma (Director)', status: 'KYC COMPLIANT' },
    { label: 'Date of Incorporation', value: '15/06/1984', status: 'CERTIFICATE REG: 034182' },
    { label: 'Entity Constitution / Category', value: 'Indian Private Limited Company', status: 'REGULAR TAXPAYER' },
    { label: 'Assessing Officer (AO) Ward', value: 'WARD 14(2)(1), MUMBAI RANGE 14', status: 'JURISDICTION VERIFIED' },
    { label: 'PAN-Aadhaar / MCA Seeding', value: 'Linked & Cryptographically Verified', status: 'MANDATE SATISFIED' },
  ];

  let currY = 565;
  headers.forEach((h, idx) => {
    // Zebra striping
    if (idx % 2 === 0) {
      page.drawRectangle({ x: 37, y: currY - 8, width: 521, height: 32, color: rgb(0.975, 0.98, 0.99) });
    }
    page.drawText(h.label, { x: 46, y: currY + 8, size: 8.5, font: bold, color: rgb(0.3, 0.35, 0.4) });
    page.drawText(h.value, { x: 235, y: currY + 8, size: 9.5, font: bold, color: rgb(0.08, 0.12, 0.18) });
    page.drawText(h.status, { x: 420, y: currY + 8, size: 7.5, font: bold, color: rgb(0.15, 0.5, 0.2) });
    currY -= 33;
  });

  // Digital Signature Block
  drawDigitalSignatureBlock(page, font, bold, {
    x: 36,
    y: 260,
    width: 523,
    height: 75,
    title: 'OFFICIALLY VERIFIED & DIGITALLY SIGNED VIA CBDT TRUST STORE',
    signer: 'DS INCOME TAX DEPARTMENT OF INDIA - AO WARD 14(2) MUMBAI',
    certPath: 'e-Mudhra Sub-CA for CBDT Tax Portals -> CCA India Sovereign Root 2026',
    hash: 'a3f8c2b190d47e11c6d32849e7b23c91e0fa5b8d2279184910248adcf7319e01',
    validDate: '2026-09-27T10:00:00+05:30 (IST)',
  });

  // GeM Compliance Acceptance Note
  page.drawRectangle({
    x: 36,
    y: 190,
    width: 523,
    height: 55,
    color: rgb(0.98, 0.98, 0.96),
    borderColor: rgb(0.85, 0.7, 0.4),
    borderWidth: 1,
  });
  page.drawText('GeM Sovereign Compliance Assessment Note:', { x: 46, y: 230, size: 8.5, font: bold, color: rgb(0.65, 0.35, 0.05) });
  page.drawText('- Automatic PAN-MCA cross-validation passed with zero mismatch in enterprise legal name.', { x: 46, y: 216, size: 7.5, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('- Vendor is compliant under Section 206AB/206CCA of the Indian Income Tax Act, 1961.', { x: 46, y: 204, size: 7.5, font, color: rgb(0.2, 0.2, 0.2) });

  return await pdfDoc.save();
}

// 2. GST Registration Certificate (Form GST REG-06)
async function createGstPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  applyGovTemplate(page, font, bold);

  // Header Box
  page.drawRectangle({
    x: 36,
    y: 705,
    width: 523,
    height: 86,
    color: rgb(0.97, 0.96, 0.99),
    borderColor: rgb(0.25, 0.15, 0.45),
    borderWidth: 1.5,
  });

  page.drawText('[ SATYAMEVA JAYATE ]', { x: 270, y: 775, size: 9, font: bold, color: rgb(0.4, 0.2, 0.1) });
  page.drawText('GOODS AND SERVICES TAX NETWORK (GSTN)', { x: 155, y: 758, size: 12, font: bold, color: rgb(0.18, 0.1, 0.42) });
  page.drawText('REGISTRATION CERTIFICATE (FORM GST REG-06)', { x: 150, y: 740, size: 11, font: bold, color: rgb(0.8, 0.35, 0.05) });
  page.drawText('Issued under Rule 10(1) of the Central Goods and Services Tax Rules, 2017', { x: 130, y: 724, size: 8, font, color: rgb(0.3, 0.3, 0.3) });

  drawSimulatedBarcode(page, font, 44, 645, 170, 42, '*27AAWBS9999P1Z5*');
  drawSimulatedQr(page, 480, 634, 64);
  page.drawText('Scan to verify on GSTN Portal', { x: 462, y: 623, size: 6, font, color: rgb(0.4, 0.4, 0.4) });

  page.drawText('REGISTRATION PARTICULARS & TAXPAYER SCHEDULE', { x: 40, y: 602, size: 11, font: bold, color: rgb(0.18, 0.1, 0.42) });

  page.drawRectangle({
    x: 36,
    y: 330,
    width: 523,
    height: 260,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.75, 0.75, 0.8),
    borderWidth: 1,
  });

  const rows = [
    { label: 'GSTIN / UIN Number', value: '27AAWBS9999P1Z5', status: 'ACTIVE / VALID' },
    { label: 'Legal Name of Business', value: 'Ananya Enterprises Pvt Ltd', status: 'REGISTERED' },
    { label: 'Trade Name', value: 'Ananya Tech Innovations', status: 'APPROVED' },
    { label: 'Constitution of Business', value: 'Private Limited Company', status: 'INCORPORATED' },
    { label: 'Address of Principal Place of Business', value: 'Plot 42, MIDC Andheri East, Mumbai - 400069', status: 'GEO-TAGGED' },
    { label: 'State & Center Jurisdiction', value: 'Maharashtra - State Ward 04 / Center Range V', status: 'COMMISSIONERATE' },
    { label: 'Date of Validity / Liability', value: '20/08/2021 to Perpetuity (Active)', status: 'REGULAR TAXPAYER' },
    { label: 'GSTR-3B / 1 Filing Track Record', value: '100% On-Time (Nil Defaults in last 24M)', status: 'HIGH RELIABILITY' },
  ];

  let currY = 562;
  rows.forEach((r, idx) => {
    if (idx % 2 === 0) {
      page.drawRectangle({ x: 37, y: currY - 8, width: 521, height: 30, color: rgb(0.98, 0.97, 0.99) });
    }
    page.drawText(r.label, { x: 46, y: currY + 6, size: 8.5, font: bold, color: rgb(0.35, 0.3, 0.45) });
    page.drawText(r.value, { x: 235, y: currY + 6, size: 9, font: bold, color: rgb(0.08, 0.1, 0.15) });
    page.drawText(r.status, { x: 440, y: currY + 6, size: 7.5, font: bold, color: rgb(0.12, 0.48, 0.18) });
    currY -= 31;
  });

  drawDigitalSignatureBlock(page, font, bold, {
    x: 36,
    y: 240,
    width: 523,
    height: 75,
    title: 'DIGITALLY SIGNED VIA GSTN NATIONAL INFRASTRUCTURE (SIFY SAFESCRYPT)',
    signer: 'DS GOODS AND SERVICES TAX NETWORK 01 - STATE TAX OFFICER',
    certPath: 'Sify Safescrypt CA (Class 3 Organizational) -> CCA India Root',
    hash: 'b4a9d3e218c50f229871a2c3d4e5f6789102837465abcedf0129384756102938',
    validDate: '2026-09-27T10:15:00+05:30 (IST)',
  });

  return await pdfDoc.save();
}

// 3. Udyam Registration Certificate (MSME)
async function createUdyamPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  applyGovTemplate(page, font, bold);

  // Header Box
  page.drawRectangle({
    x: 36,
    y: 705,
    width: 523,
    height: 86,
    color: rgb(0.99, 0.97, 0.93),
    borderColor: rgb(0.7, 0.38, 0.08),
    borderWidth: 1.5,
  });

  page.drawText('[ SATYAMEVA JAYATE ]', { x: 270, y: 775, size: 9, font: bold, color: rgb(0.4, 0.2, 0.1) });
  page.drawText('MINISTRY OF MICRO, SMALL & MEDIUM ENTERPRISES', { x: 135, y: 758, size: 12, font: bold, color: rgb(0.68, 0.32, 0.05) });
  page.drawText('UDYAM REGISTRATION CERTIFICATE', { x: 180, y: 740, size: 12, font: bold, color: rgb(0.1, 0.22, 0.42) });
  page.drawText('Conferred under MSMED Act, 2006 - Ministry of MSME, Government of India', { x: 135, y: 724, size: 8, font, color: rgb(0.3, 0.3, 0.3) });

  drawSimulatedBarcode(page, font, 44, 645, 170, 42, '*UDYAM-MH-01-00892*');
  drawSimulatedQr(page, 480, 634, 64);
  page.drawText('Scan for MSME Udyam Registry', { x: 456, y: 623, size: 6, font, color: rgb(0.4, 0.4, 0.4) });

  page.drawText('ENTERPRISE CLASSIFICATION & BENEFICIARY SCHEDULE', { x: 40, y: 602, size: 11, font: bold, color: rgb(0.68, 0.32, 0.05) });

  page.drawRectangle({
    x: 36,
    y: 330,
    width: 523,
    height: 260,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.75, 0.75, 0.8),
    borderWidth: 1,
  });

  const rows = [
    { label: 'Udyam Registration Number', value: 'UDYAM-MH-01-00892', status: 'VALIDATED' },
    { label: 'Enterprise Name', value: 'Ananya Enterprises Pvt Ltd', status: 'MATCH CONFIRMED' },
    { label: 'Type of Enterprise Classification', value: 'MICRO ENTERPRISE', status: 'EMD EXEMPTION ELIGIBLE' },
    { label: 'Major Activity Type', value: 'Manufacturing & Tech System Assembly', status: 'OPERATIONAL' },
    { label: 'National Industry Classification (NIC)', value: '2620 - Manufacture of Computers & Hardware', status: 'PRIMARY ACTIVITY' },
    { label: 'Investment in Plant & Machinery', value: 'INR 85,00,000 (Under INR 1 Crore Ceiling)', status: 'AUDITED ASSETS' },
    { label: 'Annual Turnover (Excluding Exports)', value: 'INR 2,40,00,000 (Under INR 5 Crore Ceiling)', status: 'MSME QUALIFIED' },
    { label: 'GeM Purchase Preference Benefit', value: 'Classified under Public Procurement Policy (PPP) 2012', status: 'PREFERENCE APPLIED' },
  ];

  let currY = 562;
  rows.forEach((r, idx) => {
    if (idx % 2 === 0) {
      page.drawRectangle({ x: 37, y: currY - 8, width: 521, height: 30, color: rgb(0.99, 0.98, 0.95) });
    }
    page.drawText(r.label, { x: 46, y: currY + 6, size: 8.5, font: bold, color: rgb(0.45, 0.3, 0.15) });
    page.drawText(r.value, { x: 235, y: currY + 6, size: 9, font: bold, color: rgb(0.08, 0.1, 0.15) });
    page.drawText(r.status, { x: 420, y: currY + 6, size: 7.2, font: bold, color: rgb(0.12, 0.48, 0.18) });
    currY -= 31;
  });

  drawDigitalSignatureBlock(page, font, bold, {
    x: 36,
    y: 240,
    width: 523,
    height: 75,
    title: 'DIGITALLY VERIFIED VIA NATIONAL INFORMATICS CENTRE (NIC-CA / DIGILOCKER)',
    signer: 'DS MINISTRY OF MSME - DEPUTY DIRECTOR (UDYAM VERIFICATION CELL)',
    certPath: 'NIC Sub-CA for Government Ministries -> Controller of Certifying Authorities (CCA)',
    hash: 'c7d8e9f012a34b568910fedcba98765432109876543210fedcba9876543210ab',
    validDate: '2026-09-27T09:45:00+05:30 (IST)',
  });

  return await pdfDoc.save();
}

// 4. Income Tax Return Acknowledgement (ITR-V)
async function createItrPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  applyGovTemplate(page, font, bold);

  // Header Box
  page.drawRectangle({
    x: 36,
    y: 705,
    width: 523,
    height: 86,
    color: rgb(0.96, 0.98, 0.99),
    borderColor: rgb(0.1, 0.28, 0.48),
    borderWidth: 1.5,
  });

  page.drawText('[ SATYAMEVA JAYATE ]', { x: 270, y: 775, size: 9, font: bold, color: rgb(0.4, 0.2, 0.1) });
  page.drawText('CENTRAL BOARD OF DIRECT TAXES (CBDT)', { x: 175, y: 758, size: 12, font: bold, color: rgb(0.1, 0.25, 0.45) });
  page.drawText('INDIAN INCOME TAX RETURN ACKNOWLEDGEMENT (FORM ITR-V)', { x: 110, y: 740, size: 10.5, font: bold, color: rgb(0.8, 0.32, 0.05) });
  page.drawText('Assessment Year: 2024-25 (Financial Year: 2023-24) - Section 139, Income Tax Act, 1961', { x: 105, y: 724, size: 8, font, color: rgb(0.3, 0.3, 0.3) });

  drawSimulatedBarcode(page, font, 44, 645, 170, 42, '*981245012849102*');
  drawSimulatedQr(page, 480, 634, 64);
  page.drawText('Scan to verify on e-Filing Portal', { x: 456, y: 623, size: 6, font, color: rgb(0.4, 0.4, 0.4) });

  page.drawText('FINANCIAL RETURN SUMMARY & TAX DISCHARGE STATEMENT', { x: 40, y: 602, size: 11, font: bold, color: rgb(0.1, 0.28, 0.48) });

  page.drawRectangle({
    x: 36,
    y: 330,
    width: 523,
    height: 260,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.75, 0.75, 0.8),
    borderWidth: 1,
  });

  const rows = [
    { label: 'E-Filing Acknowledgement Number', value: '981245012849102', status: 'E-VERIFIED' },
    { label: 'PAN of Assessee', value: 'AAWBS9999P', status: 'VALIDATED' },
    { label: 'Name of Enterprise Assessee', value: 'Ananya Enterprises Pvt Ltd', status: 'CONFIRMED' },
    { label: 'Filing Section & Form Code', value: '139(1) - On or before due date (ITR-6)', status: 'TIMELY FILING' },
    { label: 'Gross Total Turnover / Receipts', value: 'INR 2,40,00,000 (Two Crore Forty Lakhs)', status: 'MEETS CRITERIA' },
    { label: 'Total Taxable Income', value: 'INR 45,00,000 (Forty-Five Lakhs Only)', status: 'TAX PAID' },
    { label: 'Total Taxes Paid / Challan Deposit', value: 'INR 6,80,000 (TDS + Advance Tax Cleared)', status: 'ZERO ARREARS' },
    { label: 'Financial Soundness / Ratio', value: 'Positive Net Worth & Compliant Operating Margin', status: 'SOLVENT' },
  ];

  let currY = 562;
  rows.forEach((r, idx) => {
    if (idx % 2 === 0) {
      page.drawRectangle({ x: 37, y: currY - 8, width: 521, height: 30, color: rgb(0.97, 0.985, 1) });
    }
    page.drawText(r.label, { x: 46, y: currY + 6, size: 8.5, font: bold, color: rgb(0.25, 0.35, 0.48) });
    page.drawText(r.value, { x: 235, y: currY + 6, size: 9, font: bold, color: rgb(0.08, 0.1, 0.15) });
    page.drawText(r.status, { x: 430, y: currY + 6, size: 7.2, font: bold, color: rgb(0.12, 0.48, 0.18) });
    currY -= 31;
  });

  drawDigitalSignatureBlock(page, font, bold, {
    x: 36,
    y: 240,
    width: 523,
    height: 75,
    title: 'E-VERIFIED VIA NATIONAL E-FILING SYSTEM (DIRECT TAXES CENTRAL SYSTEM)',
    signer: 'E-VERIFICATION PORTAL - INCOME TAX DEPARTMENT GOI (EVC AADHAAR OTP)',
    certPath: 'National Informatics Centre e-Sign Gateway -> CCA Root India',
    hash: 'e8d7c6b5a493827101fedcba9876543210abcedf1234567890fedcba09871234',
    validDate: '2026-09-27T08:30:00+05:30 (IST)',
  });

  return await pdfDoc.save();
}

// 5. Debarment & Anti-Blacklisting Undertaking (GFR 2017)
async function createDebarmentAffidavitPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  applyGovTemplate(page, font, bold);

  // Top Stamp Simulation (Non-Judicial Stamp Paper aesthetic)
  page.drawRectangle({
    x: 36,
    y: 700,
    width: 523,
    height: 92,
    color: rgb(0.98, 0.97, 0.94),
    borderColor: rgb(0.5, 0.35, 0.15),
    borderWidth: 1.5,
  });

  page.drawText('GOVERNMENT OF MAHARASHTRA - NON-JUDICIAL STAMP CERTIFICATE', { x: 105, y: 775, size: 10, font: bold, color: rgb(0.5, 0.35, 0.15) });
  page.drawText('STATUTORY NON-BLACKLISTING & INTEGRITY UNDERTAKING', { x: 110, y: 755, size: 11.5, font: bold, color: rgb(0.15, 0.15, 0.15) });
  page.drawText('In compliance with Rule 151 of General Financial Rules (GFR), 2017 & GeM GTC Clause 4', { x: 95, y: 738, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('Certificate No: MH-STAMP-2026-99218 - Denomination: INR 500 E-Stamp Equivalent', { x: 105, y: 720, size: 7.5, font: bold, color: rgb(0.65, 0.3, 0.05) });

  page.drawText('SWORN STATUTORY DECLARATION & AFFIDAVIT', { x: 40, y: 672, size: 11, font: bold, color: rgb(0.12, 0.22, 0.38) });

  page.drawRectangle({
    x: 36,
    y: 350,
    width: 523,
    height: 310,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.75, 0.75, 0.8),
    borderWidth: 1,
  });

  const clauses = [
    { num: 'Clause 1', title: 'Absolute Non-Debarment & Non-Blacklisting Confirmation', desc: 'The deponent affirms that neither Ananya Enterprises Pvt Ltd nor any of its directors are blacklisted or debarred by GeM, Central Government Ministries, State Governments, or PSUs as of date.' },
    { num: 'Clause 2', title: 'Adherence to Competition Act, 2002 (Anti-Cartelization)', desc: 'The bidder explicitly covenants that bid prices are formulated independently with zero collusive bidding or cartelization practices with other competing vendors.' },
    { num: 'Clause 3', title: 'Public Procurement (Preference to Make in India) Order 2017', desc: 'The entity confirms local value addition exceeds 50% (Class-I Local Supplier status) and products originate from certified domestic supply chains.' },
    { num: 'Clause 4', title: 'Land Border Sharing Compliance (Rule 144(xi) GFR 2017)', desc: 'The entity certifies that it does not share beneficial ownership with countries sharing land borders with India without prior competent authority registration.' },
  ];

  let currY = 625;
  clauses.forEach((c) => {
    page.drawText(`${c.num}: ${c.title}`, { x: 46, y: currY, size: 9, font: bold, color: rgb(0.1, 0.2, 0.35) });
    page.drawText(c.desc, { x: 46, y: currY - 14, size: 7.8, font, color: rgb(0.2, 0.2, 0.2) });
    page.drawLine({ start: { x: 46, y: currY - 26 }, end: { x: 540, y: currY - 26 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) });
    currY -= 48;
  });

  page.drawText('Deponent Identity: Rajesh Verma (Director & Authorized Signatory, PAN: AAWBS9999P)', { x: 46, y: 395, size: 8, font: bold, color: rgb(0.15, 0.15, 0.15) });
  page.drawText('Notary Attestation: Notary Public Government of Maharashtra - Reg No: 8812/2021', { x: 46, y: 380, size: 8, font, color: rgb(0.3, 0.3, 0.3) });

  drawDigitalSignatureBlock(page, font, bold, {
    x: 36,
    y: 260,
    width: 523,
    height: 75,
    title: 'DIGITALLY EXECUTED VIA CLASS-3 ORGANIZATIONAL DIGITAL SIGNATURE (DSC)',
    signer: 'RAJESH VERMA - MANAGING DIRECTOR (ANANYA ENTERPRISES PVT LTD)',
    certPath: 'e-Mudhra Class 3 Individual and Organization CA -> Controller of Certifying Authorities',
    hash: 'f8e7d6c5b4a392817012abcdef0123456789abcdef0123456789abcdef01234567',
    validDate: '2026-09-27T11:00:00+05:30 (IST)',
  });

  return await pdfDoc.save();
}

// 6. Tampered Test Document (Negative Security Test)
async function createTamperedPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  applyGovTemplate(page, font, bold, { isTampered: true });

  // Warning Header Box
  page.drawRectangle({
    x: 36,
    y: 705,
    width: 523,
    height: 86,
    color: rgb(1, 0.92, 0.92),
    borderColor: rgb(0.85, 0.15, 0.15),
    borderWidth: 2,
  });

  page.drawText('SECURITY AUDIT NEGATIVE TEST SUITE', { x: 185, y: 775, size: 10, font: bold, color: rgb(0.8, 0.1, 0.1) });
  page.drawText('TAMPERED TEST SPECIMEN -- INTENTIONAL COMPLIANCE VIOLATION', { x: 80, y: 755, size: 12, font: bold, color: rgb(0.85, 0.1, 0.1) });
  page.drawText('Designed to verify automatic detection of byte modifications, mismatched PANs & broken DSC hashes', { x: 60, y: 735, size: 8, font: bold, color: rgb(0.3, 0.3, 0.3) });

  page.drawRectangle({
    x: 36,
    y: 430,
    width: 523,
    height: 250,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.3, 0.3),
    borderWidth: 1,
  });

  page.drawText('SIMULATED ADVERSARIAL ANOMALIES INJECTED:', { x: 46, y: 655, size: 10.5, font: bold, color: rgb(0.8, 0.1, 0.1) });

  const anomalies = [
    { title: '1. Injected Shell Company Identity', desc: 'Original signer company replaced with "Shell Enterprise Fake Ltd" post-signing.' },
    { title: '2. Cryptographic Digest Mismatch', desc: 'Signed byte stream SHA-256 does not match PKCS#7 envelope signature.' },
    { title: '3. Invalid PAN Checksum', desc: 'PAN string altered to "XX99999999", failing official CBDT MOD-11 validation algorithm.' },
    { title: '4. Revoked CA Serial Simulation', desc: 'Mock CA certificate serial simulated as revoked in National CRL/OCSP list.' },
  ];

  let currY = 625;
  anomalies.forEach((a) => {
    page.drawText(a.title, { x: 46, y: currY, size: 9, font: bold, color: rgb(0.7, 0.15, 0.15) });
    page.drawText(a.desc, { x: 46, y: currY - 14, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
    currY -= 42;
  });

  // Broken DSC Box
  page.drawRectangle({
    x: 36,
    y: 310,
    width: 523,
    height: 95,
    color: rgb(1, 0.94, 0.94),
    borderColor: rgb(0.85, 0.2, 0.2),
    borderWidth: 2,
  });

  page.drawCircle({ x: 60, y: 357, size: 14, color: rgb(0.85, 0.2, 0.2) });
  page.drawText('X', { x: 56, y: 352, size: 12, font: bold, color: rgb(1, 1, 1) });

  page.drawText('SIGNATURE DIGEST MISMATCH -- TAMPERING DETECTED BY VERIFIER', { x: 86, y: 382, size: 10, font: bold, color: rgb(0.85, 0.1, 0.1) });
  page.drawText('Expected Result in GeM Triage Desk: Immediate Red Flag & Rejection Recommendation.', { x: 86, y: 366, size: 8.5, font: bold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Backend Hash: d41d8cd98f00b204e9800998ecf8427e != Signed Certificate Attribute Digest', { x: 86, y: 350, size: 7.5, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('Status: Cryptographic integrity failed. Audit ledger entry logged with security incident flag.', { x: 86, y: 334, size: 7.5, font: bold, color: rgb(0.8, 0.2, 0.2) });

  return await pdfDoc.save();
}

async function run() {
  console.log('Generating high-fidelity Sovereign Indian Govt Mock PDFs with DEMO SPECIMEN stamping...');
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
  <!-- OFFICIAL DEMO SPECIMEN - SMART INDIA HACKATHON 2026 - EVALUATION USE ONLY -->
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
    console.log(`[OK] Wrote ${filename} to all sample directories`);
  }

  for (const d of outDirs) {
    fs.writeFileSync(path.join(d, 'sample_udyam_signed_digilocker.xml'), xmlContent, 'utf8');
  }
  console.log('[OK] Wrote sample_udyam_signed_digilocker.xml');
  console.log('All authentic mock documents with DEMO SPECIMEN stamping generated successfully.');
}

run().catch(console.error);
