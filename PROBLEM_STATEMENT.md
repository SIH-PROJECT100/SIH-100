# Problem Statement 100 — Decoded

## 1. What is actually being asked

Strip away the government phrasing and PS 100 asks for one thing: **a decision-support tool
for a Procurement Officer**, who today manually checks 10+ separate portals to confirm a
bidder's eligibility before awarding a tender. Our platform pulls together as much of that
verification as is realistically possible, presents it in one screen, flags problems
clearly, and lets the officer make the final, informed call.

It is **not** asking us to rebuild GeM itself, and it is not primarily a bidder-facing tool.
The officer is the primary user. This single fact drives almost every product decision from
here on.

> **The one sentence that matters most in the whole PS:** "The final decision regarding
> qualification/disqualification shall remain with the Procurement Officer." This rules out
> any UI pattern that looks like the system is making the decision. Everywhere we design a
> "result," we design it as a **recommendation with evidence**, never a verdict.

## 2. The three system components implied by the PS

| Component | What it does | PS wording it maps to |
|---|---|---|
| **Integration Layer** | Connects to / retrieves data from government portals and databases | "integrate with relevant Government portals and databases and retrieve/verify bidder information" |
| **AI Verification Engine** | Analyses documents + portal data, finds gaps/inconsistencies, applies compliance rules | "analyse the submitted bidder documents and portal-derived information, identify missing or inconsistent information, validate applicable compliance requirements" |
| **Compliance Dashboard** | Our frontend. Shows score, risk, doc status, pending items, recommendations | "compliance score, risk level, document verification status, pending requirements and AI-generated recommendations" |

---

## 3. Difficulty → Solution Matrix

Every real difficulty a team hits building this — technical, data-access, legal, and UX —
paired with the concrete solution we're using.

### Difficulty 1: No free/public APIs for most portals
**Why it's hard:** GSTN, Udyam, PAN/Income Tax, MCA21, NSIC do not offer open APIs to
arbitrary developers. GSTN requires a licensed GSP partnership; Income Tax has essentially
no external API at all.
**Our solution:** A tiered verification architecture — DigiLocker as the primary trusted
integration (real, obtainable sandbox access), verify-page scraping/QR-based verification
for Udyam and NSIC, and an honestly-labelled simulated GSP integration for GSTN with a clear
architecture diagram showing exactly where a real GSP contract would plug in.

### Difficulty 2: Document heterogeneity
**Why it's hard:** Bidders upload wildly inconsistent formats — skewed phone photos,
password-protected PDFs, regional-language certificates, native text PDFs, and DigiLocker's
XML-plus-PDF combo.
**Our solution:** A format-detection pre-processor: native-text PDFs → direct text
extraction; scanned/image files → OCR pipeline (Tesseract); DigiLocker-sourced files skip
OCR entirely since they arrive as verified structured data.

### Difficulty 3: Verifying claims are actually true, not just present
**Why it's hard:** A bidder can upload a fabricated or expired certificate that looks
perfectly legitimate. Reading a document isn't the same as verifying it.
**Our solution:** Layer verification by trust level — cryptographic DigiLocker signature
checks first, public verify-page/QR cross-checks second, cross-document consistency checks
(same PAN, same name, same dates) as the fallback, with low-trust items clearly flagged.

### Difficulty 4: Cross-portal identity matching
**Why it's hard:** The same company appears as "M/s Sharma Enterprises", "Sharma
Enterprises Private Limited", "SHARMA ENTERPRISES" across different certificates. Exact
string matching wrongly flags all of these as inconsistent.
**Our solution:** Fuzzy string matching (rapidfuzz) with a similarity threshold, always
anchored on PAN first (exact and unique) before falling back to fuzzy name matching.

### Difficulty 5: Compliance rules are legally precise, not fuzzy
**Why it's hard:** MSME slabs, local-content percentage classes, and GST filing-frequency
rules are exact numeric thresholds defined in government orders that change periodically.
**Our solution:** An explicit, versioned rules engine (config table, not hardcoded logic)
with an admin screen to update thresholds without a redeploy.

### Difficulty 6: No central blacklisting/debarment database
**Why it's hard:** Debarment lists are scattered across individual ministries as PDFs, with
no unified government API.
**Our solution:** Be transparent that this is the weakest link industry-wide. Propose an
internally-maintained database seeded from public ministry notices, clearly labelled as
such, paired with a manual-check reminder for the officer.

### Difficulty 7: Explainability of AI outputs
**Why it's hard:** A raw "Risk Score: 73/100" with no reasoning is unusable by an officer
who must justify their decision later.
**Our solution:** Every flag carries evidence, a confidence level, and a source (DigiLocker
verified / OCR extracted / portal fetched) — a mandatory pattern across every flagged item.

### Difficulty 8: Officer accountability & audit requirements
**Why it's hard:** The PS explicitly keeps the officer as final decision-maker — any UI that
looks like an automatic reject/accept button undermines this.
**Our solution:** An "Officer Decision" panel with mandatory reason-for-override text, and a
visible, exportable audit trail per bidder.

### Difficulty 9: Data sensitivity & security
**Why it's hard:** We're handling PAN, GST data, and financial details of real businesses.
**Our solution:** Role-based access control, PII masked by default with logged
click-to-reveal, no sensitive data in browser storage, encryption-at-rest and
data-localization noted in the architecture.

### Difficulty 10: Scale — one tender can have 50–200+ bidders
**Why it's hard:** A dashboard designed around one bidder at a time collapses at real GeM
scale.
**Our solution:** A sortable, filterable bulk table as the primary screen (sort by risk,
filter by category/status), with drill-down to bidder detail — never the reverse.

### Difficulty 11: Multilingual and regional document variation
**Why it's hard:** MSME and other certificates appear in regional languages depending on
the state; OCR accuracy drops sharply on non-English scripts.
**Our solution:** Support English + Hindi confidently for the demo (Tesseract has reasonable
Hindi support); document regional-language expansion as an explicit roadmap item.

### Difficulty 12: Distinguishing "AI" from basic automation, credibly
**Why it's hard:** Most competing teams label simple PDF-extraction-plus-if/else as "AI,"
and experienced judges spot this instantly.
**Our solution:** Be precise about where ML/LLMs genuinely add value (fuzzy matching,
natural-language explanations, anomaly detection) vs. where deterministic rules do the work.

### Difficulty 13: Officer adoption & change management
**Why it's hard:** Procurement officers are typically 45–58, used to physical files, often
wary of tools that could be blamed on them if something goes wrong.
**Our solution:** Large, high-contrast text; plain language over jargon; a visible "this is
a recommendation, you decide" framing on every screen; acknowledge officer
training/onboarding as part of a real rollout.

### Difficulty 14: Live demo fragility
**Why it's hard:** Hackathon wifi is unreliable; any real external call can fail live in
front of judges.
**Our solution:** Graceful-degradation states built into the UI — a "last verified" cached
timestamp, a visible "reconnecting..." state, and a rehearsed fallback to a 90-second backup
video.

---

## 4. Data-Source Reality Check

| Source | Real access route | Trust tier | Our approach |
|---|---|---|---|
| DigiLocker | Partner/Sandbox API (apply early, 2–4 wks) | Tier 1 — Highest | Real integration. Verify signed PDFs cryptographically. Our headline demo moment. |
| Udyam Registration | Public verify-page + QR on certificate | Tier 2 | Verify via public lookup page or decode certificate QR. |
| Startup India / DPIIT | Certificate QR + public verify page | Tier 2 | Same QR/verify-page pattern. |
| NSIC | Certificate + public verify page | Tier 2 | Same QR/verify-page pattern. |
| GSTN (GST reg. + returns) | GSP partnership required (paid, licensed) | Tier 3 — Simulated | Mock with realistic data; show exact GSP integration point in the architecture. |
| PAN / Income Tax | NSDL PAN verification licensed; ITR has no public API | Tier 3 — Simulated | Cross-check PAN format + consistency across documents; simulate ITR-filing status. |
| MCA21 | Limited public search, no free bulk API | Tier 3 — Simulated | Manual-style lookup link for officer + simulated data for demo bidders. |
| EPFO / ESIC | No practical public API; challan-based | Tier 3 — Simulated | Represent as a manual-verification checklist item. |
| Blacklisting / Debarment | No central database; scattered ministry PDFs | Tier 3 — Weakest link | Internally maintained DB seeded from public notices, clearly labelled as such. |

> **The one line to remember:** "We use DigiLocker as our trust anchor for cryptographic
> verification, public verify-pages/QR codes for a second tier of registrations, and
> clearly-labelled simulated data with a documented GSP integration path for GSTN — because
> that is what a government-grade system honestly looks like in a 36-hour build."
