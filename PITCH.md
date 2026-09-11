# The Pitch — GeM Bid Compliance Verification Platform

SIH 2026 · PS 100 · 8–10 min slot + 5 min Q&A

Spine of the whole pitch: **the verification arms race.** Bidders already have AI helping
them look compliant. The officer still doesn't have AI helping them verify it. Every section
below either sets that line up or pays it off. Don't drop it once you introduce it — the
close has to return to it.

Two roles referenced throughout: **Speaker A** (opens, closes, handles the narrative) and
**Speaker B** (drives the live demo). If you're presenting solo, ignore the split — just own
both halves.

---

## 0:00–0:40 — Cold Open

**Speaker A**, standing still, no slide up yet or a blank/dark slide:

> "Somewhere right now, a bidder is using an AI tool to help them pass a GeM eligibility
> check. It reads the tender, checks their documents against the criteria, and tells them
> exactly what to fix before they submit. It's called Minaions. It's real. It's live today.
>
> Meanwhile, the officer on the other side of that bid — the person who actually has to
> decide if that bidder is legitimate — is still opening twelve browser tabs and checking
> everything by hand.
>
> That's not a fair fight. And it's the actual problem we're solving."

*Delivery note: this needs to land deadpan and confident, not rushed. Let "It's real. It's
live today." sit for a beat before continuing — that's the line that makes judges sit up,
because it's specific and verifiable, not a hypothetical setup.*

**Now bring up Slide 1 (title).**

---

## 0:40–1:40 — The Pain, With Real Numbers

**Speaker A**, slide: one scenario, one number, nothing else on screen.

> "Ministry of Health needs 10,000 stethoscopes. Twelve bidders respond. Before the
> Procurement Officer can even start comparing prices, they have to verify each bidder
> across Udyam, GST, PAN, MCA21, Startup India, NSIC, EPFO, ESIC, and Make in India
> compliance — ten-plus separate portals, manually, per bidder.
>
> That's roughly four hours per bidder. For twelve bidders, that's a full working week —
> before evaluation even begins. Multiply that across the thousands of tenders GeM processes,
> and you're looking at one of the biggest hidden bottlenecks in Indian public procurement.
>
> We didn't just automate that. We rebuilt who it's for."

*Delivery note: say the number, then stop talking for one full second. Numbers land in
silence, not while you're already moving to the next sentence.*

---

## 1:40–2:40 — Who We Actually Built This For

**Speaker A**, slide: the officer persona, one photo-style illustration or icon, not a stock
photo of a laptop.

> "Every team you'll see today probably built a dashboard. Most of them built it for the
> bidder — because that's the easy version of this problem. We built ours for the person
> the PS is actually about: the Procurement Officer. Someone who's fifty-plus, doesn't want
> to learn a new tool, and will be personally accountable if they clear the wrong bidder.
>
> That single decision — officer first, not bidder first — is why almost everything you're
> about to see looks the way it does."

---

## 2:40–7:00 — Live Product Walkthrough

Hand off explicitly: *"I'll let [Speaker B] show you."* Don't let the walkthrough start
without a clean handoff — dead air here reads as disorganized.

### 2:40–3:20 — Bulk Triage Screen

**Speaker B**, screen live:

> "This is the officer's actual workday: the tender we just talked about, twelve bidders,
> sorted by risk automatically. Green means clear. Amber means something needs a look. Red
> means real problems. Nobody wastes time on the twelve if only three actually need
> attention — that's the point."

*Click a filter live. Show it narrow instantly. Don't explain the filter — let it be obvious.*

### 3:20–4:40 — Trust Provenance (the differentiator moment)

**Speaker B**, clicking into one bidder:

> "Here's what nobody else in this space does. Every single piece of data on this screen
> tells you where it came from and how much to trust it."

*Point at badges as you say each one — don't just describe them, physically indicate them:*

> "This one's DigiLocker Verified — cryptographically signed, effectively unforgeable.
> This one's Portal Verified — checked against the government's own certificate lookup.
> This one's AI Extracted, eighty-seven percent confidence — we read it off a scanned
> document, and we're telling you exactly how sure we are. And this one is Simulated —
> because a live GSTN integration needs a paid GSP contract we don't have in a 36-hour
> hackathon, and we'd rather tell you that honestly than pretend otherwise."

*Delivery note: that last sentence is your credibility moment. Say it plainly, no
apologetic tone. Confidence about a limitation reads as more trustworthy than a team that
has no limitations at all.*

### 4:40–5:40 — The DigiLocker Moment

**Speaker B**, triggering a live signature verification:

> "Watch this happen in real time — we're pulling this document straight from DigiLocker
> and verifying its cryptographic signature live. If a single byte of this certificate had
> been edited after signing, this check fails. No seller-side AI tool can forge this."

*Let the verification actually run and resolve on screen. If it's slow, narrate through the
wait rather than going silent — "this is hitting DigiLocker's sandbox right now" fills the
gap productively.*

### 5:40–6:20 — The Flag, With Evidence

**Speaker B**, expanding a flagged item:

> "This bidder's PAN doesn't match across two documents. We're not just showing a red flag —
> we're showing you the exact evidence, side by side, so the officer can see precisely what
> we saw."

### 6:20–7:00 — Officer Decision, Not System Decision

**Speaker B**, opening the decision panel:

> "And this is the most important screen in the whole product. We never decide. The officer
> qualifies, disqualifies, or requests clarification — and if they override what we flagged,
> we require a reason. Watch — I'm not editing this record. I'm appending to it. Nothing in
> this system ever gets quietly overwritten. It only ever grows."

---

## 7:00–8:00 — The USP, Named Explicitly

**Speaker A** takes the floor back. Slide: the four-pillar summary, minimal text.

> "So here's the honest answer to 'why is this different.' Tools like Minaions already help
> bidders pass these checks — which means a clean-looking submission isn't proof of
> compliance anymore, it might just be proof of a good AI copilot. If sellers have AI
> polishing their paperwork, the government needs AI verifying source-of-truth on the other
> side. That's the gap. Nobody's built that yet. We did.
>
> And here's the one idea underneath everything you just saw: we don't store answers, we
> store evidence — permanently, the way a ledger does. Every trust badge, every flag, every
> officer decision is a ledger entry: sourced, timestamped, and never overwritten, only
> appended to. That's not a UI choice. It's the architecture. You cannot build an auto-reject
> button on top of a system that only ever appends."

---

## 8:00–8:40 — Architecture Honesty

**Speaker A**, one clean architecture slide:

> "Quickly, so you know exactly what's real: DigiLocker integration is live, right now,
> against their sandbox. Udyam, NSIC, and Startup India are verified through public
> certificate lookups. GSTN, PAN filing status, MCA21, and EPFO are simulated with realistic
> data, because those require licensed commercial access we didn't have time to secure — and
> the exact integration point for each is documented in our architecture, ready to plug in."

---

## 8:40–9:20 — Impact & Roadmap

**Speaker A**:

> "Our path forward isn't 'launch nationwide.' It's a pilot with one ministry, on one
> tender category, with a GSP partnership for GSTN as the first real integration to add.
> Prove it there, then scale."

---

## 9:20–10:00 — Close (Return to the Hook)

**Speaker A**, slide back to something minimal — the tagline, nothing else:

> "There's already an AI helping bidders pass GeM eligibility checks. There's still no AI
> helping the officer who has to trust that check.
>
> We built the second one."

*Stop talking. Don't add "thank you, any questions" as a rushed afterthought — let the line
land, then transition to Q&A only after a clear pause.*

---

## Q&A — Rehearsed Answers

Say these out loud to a mirror or teammate at least twice before the finale — reading them
silently is not rehearsal.

**"GSTN doesn't give free API access — how do you handle this?"**
> "Through a GSP partnership — that's the licensed route every real integration in this
> space uses. We simulate that layer with realistic data and show exactly where the real
> contract plugs into our architecture."

**"What if the OCR is wrong?"**
> "Every extraction carries a confidence score. Anything below our threshold routes
> automatically to human review instead of being silently trusted."

**"What about forged DigiLocker documents?"**
> "Not practically possible — DigiLocker documents are cryptographically signed by the
> issuing authority. Any edit after signing breaks the signature, and we verify that live."

**"How is this different from Minaions or a KYC tool like AuthBridge?"**
> "Those are built for the bidder or a private buyer — neither has a reason to build officer
> accountability, mandatory override reasoning, or GeM's specific statutory thresholds. We're
> not competing with them, we're the missing half of the transaction."

**"What happens when a portal is down?"**
> "Cached last-known-good data with a visible 'last verified' timestamp, graceful
> degradation, and a manual-override path for the officer."

**"How do you ensure data privacy?"**
> "Role-based access, PII masked by default with logged reveal actions, nothing sensitive
> in client-side storage, and data-localization as a production requirement."

**"Show us what's actually working, not slides."**
> *(Don't answer this verbally — just go back to the live product and re-run the DigiLocker
> check.)*

---

## Delivery Notes That Matter More Than the Words

- **Rehearse with a timer, out loud, three times minimum**, not just read silently. Silent
  read-throughs run 30–40% faster than actual delivery — you will run over if you haven't
  timed it aloud.
- **The handoff between speakers should be one clean sentence, not a fumble.** Practice the
  exact handoff line until it's automatic.
- **If the live demo breaks, don't apologize repeatedly.** One calm line — "looks like the
  sandbox connection dropped, let me show you the recorded run" — then cut straight to the
  90-second backup video. Dwelling on the failure costs more than the failure itself.
- **Never read a slide word-for-word.** Slides carry the visual, your voice carries the
  narrative — if they're saying the same words, drop half the slide's text.
- **The cold open and the close use almost identical language on purpose.** That repetition
  is what makes the USP memorable after the panel has seen fifteen other pitches today —
  don't "improve" it into different wording during rehearsal.
