import { useState } from 'react'
import {
  HelpCircle,
  Info,
  PhoneCall,
  ShieldCheck,
  ExternalLink,
  X,
  Lock,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'

export function GovtFooter() {
  const [activeModal, setActiveModal] = useState<'faqs' | 'about' | 'contact' | null>(null)

  return (
    <>
      <footer className="mt-12 w-full bg-paper dark:bg-slate-900 border-t border-line dark:border-slate-800 text-ink-700 dark:text-slate-300 transition-colors">
        {/* Top Flag Stripe (India Tiranga Sovereign Accents) */}
        <div className="h-1.5 w-full flex">
          <div className="flex-1 bg-[#FF9933]" title="Saffron - Courage & Sacrifice" />
          <div className="flex-1 bg-white dark:bg-slate-200" title="White - Peace & Truth" />
          <div className="flex-1 bg-[#138808]" title="Green - Prosperity & Trust" />
        </div>

        {/* Main Footer Links */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
          {/* Col 1: Govt Authority & Brand */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-navy-900 dark:bg-slate-800 text-cream-50 flex items-center justify-center font-bold text-base">
                B
              </div>
              <span className="font-bold text-base text-navy-900 dark:text-cream-50 font-display">
                BharatBid Sovereign
              </span>
            </div>
            <p className="text-xs text-ink-600 dark:text-slate-400 leading-relaxed">
              Sovereign GeM Bid Compliance &amp; Trust Ledger. Automated statutory verification of GSTN, MSME,
              and MCA21 records with graph anti-cartel detection.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-risk-low dark:text-emerald-400 font-semibold mt-1">
              <ShieldCheck className="w-4 h-4" />
              <span>PostgreSQL SQL Trigger Immutability Verified</span>
            </div>
          </div>

          {/* Col 2: Help & Plain Explanations */}
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold text-ink-900 dark:text-cream-50 uppercase tracking-wider text-xs">
              Help &amp; Simple Guides
            </h4>
            <button
              type="button"
              onClick={() => setActiveModal('faqs')}
              className="text-left text-xs hover:text-navy-900 dark:hover:text-white transition-colors flex items-center gap-1.5 py-0.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-saffron-600 shrink-0" />
              <span>Frequently Asked Questions (FAQs)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('about')}
              className="text-left text-xs hover:text-navy-900 dark:hover:text-white transition-colors flex items-center gap-1.5 py-0.5"
            >
              <Info className="w-3.5 h-3.5 text-navy-700 dark:text-slate-300 shrink-0" />
              <span>About BharatBid Platform</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('contact')}
              className="text-left text-xs hover:text-navy-900 dark:hover:text-white transition-colors flex items-center gap-1.5 py-0.5"
            >
              <PhoneCall className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Contact Us &amp; Vigilance Hotline</span>
            </button>
          </div>

          {/* Col 3: Official National Portals */}
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold text-ink-900 dark:text-cream-50 uppercase tracking-wider text-xs">
              National Portals
            </h4>
            <a
              href="https://gem.gov.in"
              target="_blank"
              rel="noreferrer"
              className="text-xs hover:text-navy-900 dark:hover:text-white transition-colors flex items-center gap-1 py-0.5"
            >
              <span>GeM Portal (Government e-Marketplace)</span>
              <ExternalLink className="w-3 h-3 text-ink-400" />
            </a>
            <a
              href="https://www.gst.gov.in"
              target="_blank"
              rel="noreferrer"
              className="text-xs hover:text-navy-900 dark:hover:text-white transition-colors flex items-center gap-1 py-0.5"
            >
              <span>GSTN Common Portal</span>
              <ExternalLink className="w-3 h-3 text-ink-400" />
            </a>
            <a
              href="https://udyamregistration.gov.in"
              target="_blank"
              rel="noreferrer"
              className="text-xs hover:text-navy-900 dark:hover:text-white transition-colors flex items-center gap-1 py-0.5"
            >
              <span>Udyam MSME Registration Portal</span>
              <ExternalLink className="w-3 h-3 text-ink-400" />
            </a>
            <a
              href="https://www.india.gov.in"
              target="_blank"
              rel="noreferrer"
              className="text-xs hover:text-navy-900 dark:hover:text-white transition-colors flex items-center gap-1 py-0.5"
            >
              <span>National Portal of India</span>
              <ExternalLink className="w-3 h-3 text-ink-400" />
            </a>
          </div>

          {/* Col 4: Sovereign Compliance & SIH */}
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold text-ink-900 dark:text-cream-50 uppercase tracking-wider text-xs">
              Smart India Hackathon 2026
            </h4>
            <p className="text-xs text-ink-600 dark:text-slate-400 leading-relaxed">
              Problem Statement 100: AI-Assisted GeM Procurement Verification &amp; Dual-Layer Trust Ledger.
            </p>
            <div className="p-2.5 bg-cream-50 dark:bg-slate-800 rounded-lg border border-line dark:border-slate-700 text-xs flex flex-col gap-1 mt-1">
              <span className="font-semibold text-navy-900 dark:text-cream-50">Maker-Checker Safety:</span>
              <span className="text-ink-600 dark:text-slate-400 text-micro">
                Two-officer concurrence required for high-value tenders. All decision events hashed to Merkle chain.
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Disclaimer */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 border-t border-line dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs text-ink-500 dark:text-slate-400">
          <span>
            © 2026 Government of India · Smart India Hackathon Prototype (SIH26100). All rights reserved.
          </span>
          <div className="flex items-center gap-4">
            <span>Sovereign Security: Level 4</span>
            <span>·</span>
            <span>Server Time: IST (UTC +5:30)</span>
          </div>
        </div>
      </footer>

      {/* ─── Interactive Modals (FAQs, About, Contact) ─────────────── */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-paper dark:bg-slate-900 text-ink-900 dark:text-cream-50 rounded-2xl border border-line dark:border-slate-700 shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-line dark:border-slate-800 flex items-center justify-between sticky top-0 bg-paper/95 dark:bg-slate-900/95 backdrop-blur-sm z-10">
              <div className="flex items-center gap-2.5">
                {activeModal === 'faqs' && <HelpCircle className="w-5 h-5 text-saffron-600" />}
                {activeModal === 'about' && <Info className="w-5 h-5 text-navy-800 dark:text-saffron-400" />}
                {activeModal === 'contact' && <PhoneCall className="w-5 h-5 text-emerald-600" />}
                <h3 className="text-lg font-bold">
                  {activeModal === 'faqs' && 'Frequently Asked Questions (FAQs)'}
                  {activeModal === 'about' && 'About BharatBid Platform'}
                  {activeModal === 'contact' && 'Contact Support & Helpdesk'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-ink-500 hover:text-ink-900 dark:hover:text-white hover:bg-cream-100 dark:hover:bg-slate-800 transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4 text-sm leading-relaxed">
              {activeModal === 'faqs' && (
                <div className="flex flex-col gap-4">
                  <div className="p-3.5 bg-cream-50 dark:bg-slate-800 rounded-xl border border-line dark:border-slate-700">
                    <h4 className="font-bold text-navy-900 dark:text-cream-50">
                      1. What does the "Verified ✓" badge mean?
                    </h4>
                    <p className="text-ink-600 dark:text-slate-300 mt-1 text-xs">
                      It means your document has successfully completed all 4 stages: file integrity check,
                      AI field extraction, cross-matching against your business profile, and portal digital signature
                      validation.
                    </p>
                  </div>

                  <div className="p-3.5 bg-cream-50 dark:bg-slate-800 rounded-xl border border-line dark:border-slate-700">
                    <h4 className="font-bold text-navy-900 dark:text-cream-50">
                      2. What is "Bidding Ring / Group Fraud" (formerly Cartel)?
                    </h4>
                    <p className="text-ink-600 dark:text-slate-300 mt-1 text-xs">
                      In simple words, it is when two or more companies secretly collaborate by sharing directors,
                      offices, or matching prices to cheat government tender competition. BharatBid's AI network graph
                      automatically detects these hidden connections.
                    </p>
                  </div>

                  <div className="p-3.5 bg-cream-50 dark:bg-slate-800 rounded-xl border border-line dark:border-slate-700">
                    <h4 className="font-bold text-navy-900 dark:text-cream-50">
                      3. Why can't records in the Trust Ledger be deleted or edited?
                    </h4>
                    <p className="text-ink-600 dark:text-slate-300 mt-1 text-xs">
                      The PostgreSQL database has an unbreakable trigger rule (lockdown). Once an evaluation or
                      tender bid decision is saved, even a database administrator cannot change it. This guarantees
                      honest, corruption-free public procurement defense.
                    </p>
                  </div>

                  <div className="p-3.5 bg-cream-50 dark:bg-slate-800 rounded-xl border border-line dark:border-slate-700">
                    <h4 className="font-bold text-navy-900 dark:text-cream-50">
                      4. What is EMD Exemption?
                    </h4>
                    <p className="text-ink-600 dark:text-slate-300 mt-1 text-xs">
                      Earnest Money Deposit (EMD) is waived for registered MSMEs under Government of India guidelines.
                      Once your Udyam certificate is verified in BharatBid, your bids are automatically exempt from EMD
                      fees.
                    </p>
                  </div>
                </div>
              )}

              {activeModal === 'about' && (
                <div className="flex flex-col gap-3">
                  <p>
                    <strong>BharatBid</strong> is an advanced, sovereign decision-support platform designed specifically
                    for the <strong>Government e-Marketplace (GeM)</strong> ecosystem under <strong>Smart India Hackathon 2026 (Problem Statement 100)</strong>.
                  </p>
                  <p className="text-xs text-ink-600 dark:text-slate-300">
                    Every year, over ₹4 Lakh Crore worth of public procurement occurs in India. BharatBid solves the
                    critical bottlenecks faced by Procurement Officers by cross-checking bidder tax and business registrations
                    (GSTN, CBDT PAN, MSME Udyam, MCA21) in a single pane of glass, preventing shadow bidding rings, and
                    sealing every decision into an append-only cryptographic ledger.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="p-3 bg-cream-50 dark:bg-slate-800 rounded-lg border border-line dark:border-slate-700">
                      <span className="font-bold text-xs text-navy-900 dark:text-cream-50">For Procurement Officers:</span>
                      <p className="text-micro text-ink-600 dark:text-slate-400 mt-0.5">
                        Bulk evaluation in seconds, automated compliance scores, and complete legal vigilance protection.
                      </p>
                    </div>
                    <div className="p-3 bg-cream-50 dark:bg-slate-800 rounded-lg border border-line dark:border-slate-700">
                      <span className="font-bold text-xs text-navy-900 dark:text-cream-50">For MSME Bidders:</span>
                      <p className="text-micro text-ink-600 dark:text-slate-400 mt-0.5">
                        One-click digital document vault, verifiable trust score, and seamless tender applications.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === 'contact' && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-ink-600 dark:text-slate-300">
                    For technical support, tender inquiries, or reporting irregular bidding behavior:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-cream-50 dark:bg-slate-800 rounded-xl border border-line dark:border-slate-700 flex items-start gap-2.5">
                      <Phone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-xs text-navy-900 dark:text-cream-50">GeM Helpdesk Toll-Free:</span>
                        <p className="text-xs text-ink-600 dark:text-slate-300 font-mono mt-0.5">1800-419-3436 / 1800-102-3436</p>
                        <span className="text-micro text-ink-500">Mon - Sat: 9:00 AM - 6:00 PM IST</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-cream-50 dark:bg-slate-800 rounded-xl border border-line dark:border-slate-700 flex items-start gap-2.5">
                      <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-xs text-navy-900 dark:text-cream-50">Technical Helpdesk:</span>
                        <p className="text-xs text-ink-600 dark:text-slate-300 font-mono mt-0.5">support@bharatbid.gov.in</p>
                        <span className="text-micro text-ink-500">24x7 Automated Ticket System</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-cream-50 dark:bg-slate-800 rounded-xl border border-line dark:border-slate-700 flex items-start gap-2.5">
                      <Lock className="w-4 h-4 text-risk-critical shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-xs text-navy-900 dark:text-cream-50">CVC Anti-Corruption Hotline:</span>
                        <p className="text-xs text-ink-600 dark:text-slate-300 font-mono mt-0.5">1800-11-0180 (Toll Free)</p>
                        <span className="text-micro text-ink-500">Central Vigilance Commission</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-cream-50 dark:bg-slate-800 rounded-xl border border-line dark:border-slate-700 flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-saffron-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-xs text-navy-900 dark:text-cream-50">Headquarters:</span>
                        <p className="text-xs text-ink-600 dark:text-slate-300 mt-0.5">Ministry of Commerce &amp; Industry, New Delhi</p>
                        <span className="text-micro text-ink-500">Government of India</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-line dark:border-slate-800 flex justify-end bg-cream-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-navy-900 dark:bg-saffron-600 text-cream-50 text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
