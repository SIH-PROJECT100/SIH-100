from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
import os
import shutil

OUTPUT_DIR = "demo-assets/verification-kit"
os.makedirs(OUTPUT_DIR, exist_ok=True)

NAVY = HexColor("#0F2942")
GREY = HexColor("#E5E1D8")

def styled_doc(filename, header_title, header_subtitle, fields, footer_note):
    path = os.path.join(OUTPUT_DIR, filename)
    c = canvas.Canvas(path, pagesize=A4)
    w, h = A4

    # Header band
    c.setFillColor(NAVY)
    c.rect(0, h - 90, w, 90, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, h - 45, header_title)
    c.setFont("Helvetica", 10)
    c.drawString(50, h - 65, header_subtitle)

    # Field box
    y = h - 140
    c.setStrokeColor(NAVY)
    c.setLineWidth(1)
    box_height = 24 * len(fields) + 20
    c.rect(50, y - box_height, w - 100, box_height, fill=0, stroke=1)

    c.setFillColor(HexColor("#000000"))
    fy = y - 10
    for label, value in fields:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(65, fy, f"{label}:")
        c.setFont("Helvetica", 10)
        c.drawString(220, fy, str(value))
        fy -= 24

    # Footer
    c.setFillColor(HexColor("#888888"))
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(50, 40, footer_note)
    c.drawString(50, 28, "SIMULATION DOCUMENT — Smart India Hackathon 2026 demo purposes only.")

    c.save()
    print(f"Created {path}")

styled_doc(
    "bidder_A_pan_card.pdf",
    "INCOME TAX DEPARTMENT",
    "Government of India — Permanent Account Number Card",
    [
        ("Name", "BHARAT INDUSTRIAL SYSTEMS PVT LTD"),
        ("PAN", "AABCB1234K"),
        ("Date of Registration", "15/04/2019"),
        ("Status", "ACTIVE"),
    ],
    "Document Reference: SIM-PAN-0001",
)

styled_doc(
    "bidder_A_gst_certificate.pdf",
    "GOODS AND SERVICES TAX",
    "Certificate of Registration",
    [
        ("GSTIN", "08AABCB1234K1Z7"),
        ("Legal Name", "BHARAT INDUSTRIAL SYSTEMS PVT LTD"),
        ("Trade Name", "Bharat Industrial Systems"),
        ("Registration Date", "15/04/2019"),
        ("State", "Rajasthan"),
        ("Type", "Regular"),
    ],
    "Document Reference: SIM-GST-0001",
)

styled_doc(
    "bidder_B_pan_card.pdf",
    "INCOME TAX DEPARTMENT",
    "Government of India — Permanent Account Number Card",
    [
        ("Name", "ABC INDUSTRIES PVT LTD"),
        ("PAN", "AADCC5678M"),
        ("Date of Registration", "12/06/2020"),
        ("Status", "ACTIVE"),
    ],
    "Document Reference: SIM-PAN-0002",
)

styled_doc(
    "bidder_B_gst_certificate.pdf",
    "GOODS AND SERVICES TAX",
    "Certificate of Registration",
    [
        ("GSTIN", "08AADCC5678M1Z9"),
        ("Legal Name", "ABC INDUSTRIES PRIVATE LIMITED"),
        ("Trade Name", "ABC Industries"),
        ("Registration Date", "12/06/2020"),
        ("State", "Maharashtra"),
        ("Type", "Regular"),
    ],
    "Document Reference: SIM-GST-0002",
)

styled_doc(
    "bidder_B_oem_authorization.pdf",
    "OEM AUTHORIZATION LETTER",
    "Manufacturer-Issued Dealer Authorization",
    [
        ("Manufacturer", "SafetyFirst Industries Ltd"),
        ("Authorized Dealer", "ABC INDUSTRIES PVT LTD"),
        ("Authorization No.", "OEM-2024-8492"),
        ("Valid From", "01 April 2024"),
        ("Valid Until", "31 March 2025"),
    ],
    "Document Reference: SIM-OEM-0002",
)

styled_doc(
    "bidder_C_oem_authorization.pdf",
    "OEM AUTHORIZATION LETTER",
    "Manufacturer-Issued Dealer Authorization",
    [
        ("Manufacturer", "SafetyFirst Industries Ltd"),
        ("Authorized Dealer", "XYZ TECHNOLOGIES PVT LTD"),
        ("Authorization No.", "OEM-2024-7731"),
        ("Valid From", "01 August 2025"),
        ("Valid Until", "31 J*ly 2026 [scan degraded]"),
    ],
    "Document Reference: SIM-OEM-0003",
)

# Also copy to frontend public directory
frontend_dir = os.path.abspath("../bharatbid/public/demo-assets/verification-kit")
if os.path.exists(os.path.dirname(frontend_dir)):
    os.makedirs(frontend_dir, exist_ok=True)
    for fname in os.listdir(OUTPUT_DIR):
        if fname.endswith(".pdf"):
            shutil.copy2(os.path.join(OUTPUT_DIR, fname), os.path.join(frontend_dir, fname))
    print(f"Copied PDFs to frontend public directory: {frontend_dir}")

print("6 styled demo PDFs generated.")
