# BharatBid: AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement

**Team Name:** Segmentation Fault  
**Problem Statement ID:** SIH26100  
**Title:** AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement  
**Theme:** Smart Automation  
**Category:** Software  

---

## 1. The Problem

The Government e-Marketplace (GeM) has transformed public procurement across India, handling over 18.4 lakh crore rupees in cumulative gross merchandise value, with micro and small enterprises executing 68 percent of order volume. While publishing tenders and submitting bids has been successfully digitized, the evaluation stage remains a severe bottleneck. 

Evaluating a single tender with 20 to 50 bidders requires a procurement officer to inspect five to seven statutory documents per vendor. These include GST registration certificates, PAN cards, Udyam MSME certificates, audited income tax returns, OEM authorizations, and past performance certificates. Today, officers verify these documents manually. They open hundreds of separate PDFs, compare company names, registration numbers, and dates by eye, and log into multiple government websites (GSTN, Income Tax, and Udyam) one by one. There is no unified record of what was checked, when it was checked, or what evidence was reviewed.

Under intense deadline pressure, clerical discrepancies are easily missed. A bidder's legal name on a GST certificate may subtly differ from the name on their PAN card. An OEM authorization letter might have expired days before the bid submission deadline. A vendor's average annual turnover across three assessment years might fall slightly short of the mandatory threshold, requiring manual arithmetic that current portals do not automate.

Automated tools often introduce risks of their own by treating every extracted value with blind confidence. When an uploaded document is blurry, skewed, or poorly scanned, an automated system should never guess or invent data. If an extraction is ambiguous or conflicting values appear across documents, the issue must be escalated to a human officer with the underlying evidence clearly presented.

Furthermore, procurement officers currently have no tooling to evaluate bidders comparatively or detect coordinated market manipulation. When multiple bidders share common directors, identical registered addresses, common submission IP addresses, or suspicious pricing clusters, these red flags remain invisible when evaluating bidders one by one.

Finally, public procurement decisions carry substantial legal and financial responsibility. Current workflows often leave qualification decisions to a single individual without an independent second review. Crucially, existing platforms lack a permanent, tamper-evident audit trail connecting the evidence reviewed to the decision taken, leaving the procurement process vulnerable to disputes, administrative delays, and lost public trust.

---

## 2. Proposed Solution

BharatBid is an intelligent decision-support platform designed specifically for the technical evaluation stage of GeM procurement. It sits directly between bid submission and the final award decision. The platform does not replace GeM, and it does not make binding award decisions on its own. Public procurement requires legal and administrative accountability that belongs exclusively to authorized human officers. What BharatBid does is streamline the most demanding part of the process: reviewing dozens of vendor submissions, cross-checking evidence across multiple documents, and keeping a permanent, defensible record of every evaluation step.

The platform is built around five core engineering principles:

### Centralized Comparative Triage
Evaluating 30 to 50 bidders by opening separate files sequentially is inefficient. BharatBid brings all participating bidders onto a single risk-sorted triage screen. Because an officer's actual workload is comparative, our dashboard ranks vendors by compliance risk. Statutory verification statuses for GST, PAN, Udyam, financial turnover, and local supplier declarations are visible at a glance, allowing officers to spot high-risk submissions immediately and prioritize their review.

### Strict Separation of AI Extraction and Deterministic Rules
A major failure mode in modern software is allowing probabilistic language models to make legal or compliance judgments. In BharatBid, Google Gemini is strictly confined to data extraction. It reads unstructured PDFs and extracts structured fields (such as GSTINs, PAN numbers, turnover amounts, and validity dates) along with individual confidence scores. All compliance verification is handled entirely by hand-written, deterministic code. Regex patterns and official checksum algorithms validate GSTINs, date arithmetic checks whether certificates were valid on the bid deadline, and numerical logic evaluates turnover thresholds. The AI only reads the paperwork; transparent, verifiable code decides compliance.

### Complete Evidence Provenance
No value or status appears on screen without an explicit record of where it came from. Every data point is tagged with its source: extracted from an uploaded document with a confidence rating, returned via an external registry lookup, or entered manually by an official. When an inconsistency is detected, the system displays both conflicting documents side by side with the relevant fields highlighted. The officer can verify the underlying evidence directly rather than relying on an opaque pass or fail badge.

### Dual-Officer Sign-Off (Four-Eyes Principle)
The qualification decision is the highest-stakes step in procurement, making it vulnerable to clerical errors or undue pressure. BharatBid enforces the Central Vigilance Commission four-eyes principle directly in software. When an evaluating officer decides to qualify, disqualify, or seek clarification from a bidder, that decision is provisional. It automatically routes to an independently assigned second officer who must review the exact same evidence and concur before the decision becomes final. Disagreements escalate to an administrative authority for documented resolution.

### Database-Enforced Immutable Audit Trail
Every document upload, automated verification step, officer comment, and qualification decision is written to an append-only ledger in PostgreSQL. Immutability is enforced at the database level rather than through application logic alone. The backend database role is granted only SELECT and INSERT privileges, while a custom PostgreSQL trigger rejects any UPDATE or DELETE command, even from a superuser. Every ledger entry is also cryptographically chained using SHA-256 hashes, providing an auditable, tamper-evident record across the entire life of the tender.

---

## 3. Technical Approach

### Architecture Overview
BharatBid follows a modular three-tier architecture with an isolated adapter layer designed for government registry communication. The frontend is built with React 19 and TypeScript, styled with Tailwind CSS, and uses TanStack Query and TanStack Table for efficient data-fetching and dense tabular views. The backend is built using Node.js, Express, and TypeScript for end-to-end type safety. All persistent application data, compliance rules, bidder profiles, and the verification ledger reside in PostgreSQL 15.

To handle external government databases realistically during development, we introduced the GovernmentVerificationAdapter interface. In a hackathon setting, no team possesses authorized production API credentials for GSTN, MCA21, Udyam, or EPFO. Instead of hardcoding mock data into application screens, our adapter cleanly separates verification logic into swappable implementations: Demo, Sandbox, and Production. Downstream application logic (document intake, AI parsing, cross-checking, rule validation, and audit logging) interacts only with this interface. When official production credentials become available, only the adapter implementation changes; no core application code needs modification.

### The Verification Pipeline
When a bidder submits their documents, the platform executes a sequential, verifiable evaluation pipeline:

1. **File Validation and Cryptographic Hashing:** Every uploaded file undergoes file-signature (magic byte) checking and MIME validation to ensure genuine PDFs and XML certificates. Each accepted document is immediately hashed using SHA-256 to create an unalterable reference point.
2. **AI-Assisted Extraction:** Google Gemini processes the documents using structured schemas, extracting critical fields such as legal entity names, identification numbers, validity dates, and turnover values, each accompanied by an extraction confidence score.
3. **Cross-Document Consistency Checking:** Extracted data points are compared across all documents submitted by the bidder. If a GST certificate reads "ABC Industries Private Limited" while a PAN card lists "ABC Industries Pvt Ltd", the system flags the variance, displays both source documents, and leaves the judgment of materiality to the human reviewer.
4. **Registry Verification:** The system queries government registries through our adapter layer. In our current implementation, this returns schema-accurate mock responses structured identically to official government APIs, with each check clearly labeled with a Simulation Mode badge in the interface.
5. **Deterministic Rule Evaluation:** Pure TypeScript logic applies tender-specific eligibility requirements. The system verifies identifier checksums, validates that document validity spans past the bid submission date, and checks whether average turnover meets mandatory thresholds.
6. **Confidence-Gated Routing:** The system routes verification results based on confidence scores. High-confidence extractions (above 90 percent) clear automatically. Borderline extractions (between 60 and 90 percent) are flagged for mandatory officer review. Extractions below 60 percent are treated as inconclusive, presenting the original document crop directly to the officer rather than making an automated guess.
7. **Immutable Audit Logging:** Every pipeline stage writes an attributed entry into the PostgreSQL audit ledger, recording what was checked, the timestamp, the input evidence, and the resulting score.

---

## 4. Feature Walkthrough

BharatBid provides purpose-built workspaces tailored to three primary user roles: procurement officers, bidders, and system administrators.

### For Procurement Officers
The procurement officer workflow centers on high-volume comparative review:

- **Triage Dashboard:** The officer lands on a risk-sorted table listing all bidders for a tender. Each row displays five core compliance indicators: MSME status, GST active standing, PAN/ITR consistency, Blacklist screening, and Make in India (Class-1 Local Supplier) status, alongside an aggregated risk band.
- **Bidder Detail View:** Selecting any bidder opens an in-depth view organized into five clear tabs:
  - *Overview Tab:* Displays the bidder's calculated trust score alongside an itemized breakdown showing every contributing rule and weight.
  - *Compliance Checks Tab:* Presents an expandable timeline for every statutory check, tracking progress from file upload through AI extraction, cross-document comparison, registry lookup, and confidence gating. Each step shows the raw extracted values and side-by-side document crops.
  - *Trust Profile Tab:* Summarizes historical compliance records, past tender performance, and verified enterprise attributes.
  - *Officer Decision Tab:* Implements the dual-officer sign-off workflow, requiring the primary officer to select an action (Qualify, Disqualify, or Request Clarification) accompanied by mandatory written justification.
  - *Trust Ledger Tab:* Shows a chronological, complete audit log of every automated check and human action recorded for that specific bidder.
- **Tender Ledger and Cartel Detection:** A dedicated tender-level view tracks overall procurement progress and runs multi-factor cartel detection. The engine analyzes six distinct signals: shared company directors, identical registered physical addresses, common submission IP subnets, matching digital certificate credentials, and statistical clustering in submitted price quotes. The findings are rendered as an interactive relationship graph, highlighting potential collusion as "requires investigation" for the officer to evaluate without making automated accusations.

### For Bidders
The bidder portal is designed to make compliance clear and predictable:

- **Company Dashboard:** Gives vendors a transparent view of their compliance health, overall trust score, active bid count, and recent activity.
- **Document Vault:** An organized repository for statutory certificates. Bidders can view verification statuses, inspect older document versions, and review the exact stage-by-stage verification timeline seen by procurement officers.
- **Tender Discovery and Applications:** Bidders can browse open GeM tenders, filter for opportunities matching their specific compliance profile, save opportunities, and track active applications.
- **Bid Vault and Audit Reports:** Vendors can review past submissions and download cryptographically-chained PDF audit summaries for their own compliance records.

### For System Administrators
Administrators maintain governance, calibrate system behavior, and oversee platform integrity:

- **Rules Configurator:** A live configuration interface that allows administrators to adjust compliance check weights, tune AI confidence thresholds, calibrate cartel-detection sensitivity, and define escalation triggers for secondary reviews, all without requiring code deployments.
- **Ledger Explorer:** A terminal-style search console allowing auditors to query the complete system ledger by date, actor, action type, bidder, or tender ID, with export options in CSV and PDF formats.
- **Immutability Proof Console:** An interactive administrative tool that deliberately executes UPDATE and DELETE statements against the running PostgreSQL ledger table, displaying the actual database-level rejection errors in real time to prove that historical records cannot be altered.

### Platform-Wide Capabilities
The platform supports bilingual operations in English and Hindi, enforces server-side role-based access control across all API routes, and includes an offline DEMO_MODE that executes the entire verification pipeline deterministically without requiring an internet connection. The codebase is backed by 275 automated tests across 22 test files, executed against an isolated testing database schema.

---

## 5. Differentiators and Governance Controls

BharatBid differs fundamentally from generic document-reading utilities because it is designed around institutional trust and administrative integrity:

1. **AI Extracts, Code Decides:** Unlike systems that ask a language model whether a document complies, BharatBid restricts AI exclusively to data parsing. Every compliance verdict is determined by deterministic, verifiable code applying mathematical thresholds, date logic, and official checksums.
2. **Confidence-Gated Accountability:** Instead of assigning an arbitrary pass badge to low-quality scans, our architecture uses strict confidence thresholds. Blurry or ambiguous documents are marked inconclusive and escalated to a human officer, eliminating automated hallucinations.
3. **Cross-Document Discrepancy Matrix:** The platform cross-references data points across all submitted documents, identifying subtle inconsistencies (such as name discrepancies or differing registration dates) that manual inspections frequently overlook.
4. **Software-Enforced Dual-Officer Review:** The platform mirrors the Central Vigilance Commission four-eyes principle by requiring an independent secondary officer to concur with any qualification decision before it becomes final, preventing unilateral or compromised decisions.
5. **Database-Level Immutability:** Audit integrity does not rely on application discipline alone. Restricted database roles and custom triggers reject any attempt to modify or delete historical records, while cryptographic SHA-256 hash chaining ensures complete tamper-evidence.
6. **Comparative Bulk Triage:** The interface is built for how procurement officers actually work, allowing them to compare 30 to 50 bidders on one screen, sort by risk, and focus their attention on genuine exceptions.
7. **Transparent Registry Adapters:** BharatBid avoids making false claims about government API integrations. External lookups are explicitly labeled as simulations in the interface and isolated behind an adapter layer, ensuring a clean and direct path to production deployment.

---

## 6. What's Real vs. Simulated

A credible public procurement system requires absolute transparency regarding what has been built versus what relies on simulated data due to hackathon constraints. During development, no student team has access to production government APIs for GSTN, MCA21, Udyam, or EPFO, as these require formal institutional accreditation and paid API gateways. Rather than concealing this constraint or hardcoding fake data directly into views, BharatBid uses an explicit adapter layer (GovernmentVerificationAdapter) that cleanly separates our core evaluation logic from external data providers.

### What is completely real and running in code:
- **Document intake:** Uploaded PDFs undergo magic-byte file signature validation, MIME checks, and SHA-256 cryptographic hashing on arrival.
- **AI extraction:** Live calls to Google Gemini extract fields and confidence scores from uploaded documents, backed by a deterministic offline mode for reliable demos.
- **Rules engine:** GSTIN checksum algorithms, certificate expiry date calculations, and financial turnover checks are written in pure TypeScript with zero AI guesswork.
- **Cross-document verification:** The system cross-references extracted details across different PDFs to flag name, number, or date discrepancies automatically.
- **Confidence gating:** High-confidence extractions clear automatically, borderline cases route to mandatory officer review, and degraded scans are flagged as inconclusive.
- **Database immutability:** PostgreSQL role permissions allow only SELECT and INSERT. Custom database triggers block UPDATE and DELETE queries even from superusers, provable via a live tamper-test console.
- **Governance:** The dual-officer review workflow and multi-signal cartel detection graph are fully functional.

### What is simulated:
- **External registry lookups:** Live active-status checks for GSTN, PAN, and Udyam run through our adapter using schema-accurate mock responses structured like real government APIs. Every simulated check is visibly labeled with a "Simulation Mode" badge in the interface.
- **DigiLocker verification:** XML signature verification is functional but checks against a local test Certificate Authority rather than the production DigiLocker root.
- **Debarment checking:** Blacklist screening queries an internal reference table compiled from public government debarment orders.

---

## 7. Feasibility and Viability

### Technical Feasibility
BharatBid is built entirely on proven, production-grade technologies: React, Node.js, Express, and PostgreSQL. It requires no exotic hardware or proprietary infrastructure. By isolating government registry communications behind the GovernmentVerificationAdapter interface, the platform eliminates architectural risk. Transitioning from mock responses to live government APIs is an integration task involving API keys and endpoints rather than a platform redesign. Furthermore, the built-in DEMO_MODE allows the complete pipeline to run deterministically offline, ensuring dependable demonstrations and robust local development.

### Operational and Economic Viability
Operationally, BharatBid does not force procurement departments to abandon existing governance protocols. Instead, it augments the officer's workflow by automating document collection, performing repetitive arithmetic, highlighting discrepancies, and assembling the evidence in one place. Final decision-making authority remains firmly with the human officer.

Economically, the platform operates with minimal overhead. It does not require continuous GPU infrastructure, and external model calls to Google Gemini can be managed cost-effectively with caching and fallback modes. Considering that GeM processes over five lakh crore rupees in annual transactions across thousands of tenders, compressing verification time from days to minutes per tender offers immense administrative savings and allows procurement teams to handle growing volumes without proportional staffing increases.

### Adaptability and Scalability
The underlying architecture (extracting data, cross-checking across files, executing deterministic rules, gating on confidence, and recording in an immutable ledger) is modular. It can readily scale beyond GeM procurement to other high-stakes public-sector verification workflows, including state-level tender portals, grant disbursement reviews, and statutory vendor licensing.

---

## 8. Impact and Benefits

### Operational and Economic Impact
By automating document intake, data extraction, and preliminary verification, BharatBid reduces per-bidder evaluation time from hours to minutes. A complex tender with 30 bidders that previously required several days of tedious document inspection can now be evaluated in hours. This efficiency directly accelerates tender turnaround times, reduces procurement backlogs, and supports the government's policy mandate of encouraging MSME participation in public procurement.

### Social and Fair-Play Impact
Manual reviews conducted under tight deadlines often result in genuine small vendors being rejected over harmless clerical variances. BharatBid protects honest MSMEs by surfacing exact document context and providing officers with clear explanations rather than arbitrary rejections. Simultaneously, the cartel-detection engine identifies coordinated bidding behaviors, ensuring that public contracts are awarded transparently and competitively.

### Governance and Institutional Trust
BharatBid embeds statutory compliance directly into software. By enforcing the Central Vigilance Commission four-eyes principle, the platform prevents unilateral decisions and reduces exposure to corruption or coercion. Every action, extraction, and rationale is preserved in an immutable, cryptographically chained audit ledger, providing vigilance officers, auditors, and courts with a complete, tamper-proof record of every procurement decision.

### Usability and Accessibility
With full bilingual support in English and Hindi, an intuitive comparative triage view, and step-by-step verification timelines, BharatBid ensures that both experienced procurement officers and small enterprise bidders can navigate public procurement with clarity and confidence.

---

## 9. Conclusion

The primary challenge in modern public procurement is no longer publishing tenders or accepting bids. Those stages have been successfully digitized. The real challenge is establishing trustworthy, auditable, and efficient verification of submitted documents at the scale of thousands of tenders and millions of bidder interactions.

BharatBid addresses this challenge directly. By strictly separating AI data extraction from deterministic code validation, enforcing a dual-officer review process, guaranteeing database-level audit immutability, and maintaining complete transparency regarding simulated registry adapters, the platform provides a dependable and practical decision-support system. It protects the integrity of public funds, accelerates tender timelines, and keeps human judgment at the center of public procurement.
