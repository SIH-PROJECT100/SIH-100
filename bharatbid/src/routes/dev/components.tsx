import { useState } from 'react'
import {
  Shield,
  Search,
  Filter,
  Download,
  Plus,
  Send,
  Trash2,
  FileCheck,
} from 'lucide-react'
import {
  Button,
  Input,
  Textarea,
  Select,
  Badge,
  RiskBadge,
  TrustBadge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Timestamp,
  CopyableId,
  PageHeader,
  EmptyState,
  Skeleton,
  Modal,
  Drawer,
  Tabs,
  TabList,
  TabTrigger,
  TabContent,
  Confirm,
  LanguageToggle,
  notify,
} from '@/components/ui'
import { Logo } from '@/components/Logo'

export default function DevComponentsPage() {
  // Interactive states for modals & drawers
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [tableDensity, setTableDensity] = useState<'normal' | 'compact'>('normal')

  return (
    <div className="min-h-screen bg-cream-50 p-6 md:p-10 text-ink-900">
      <div className="max-w-shell mx-auto flex flex-col gap-10">
        {/* Component 10: PageHeader */}
        <PageHeader
          title="BharatBid Component Library"
          subtitle="All 17 design-token primitives built to strict government formal specifications"
          breadcrumbs={[
            { label: 'BharatBid', href: '/tenders' },
            { label: 'Developer System', href: '/dev/components' },
            { label: 'UI Primitives Gallery' },
          ]}
          badge={
            <span className="px-2 py-0.5 rounded text-micro font-mono bg-saffron-100 text-saffron-600 font-semibold border border-saffron-500/20">
              17 / 17 Primitives Ready
            </span>
          }
          actions={
            <div className="flex items-center gap-3">
              {/* Component 17: LanguageToggle */}
              <LanguageToggle />
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={() => notify.info('Exporting component spec…')}
              >
                Export Specs
              </Button>
            </div>
          }
        />

        {/* ─── 0. Brand Identity & Logo ────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h2 className="text-h3 font-semibold text-navy-900">0. Brand Identity (<Logo />)</h2>
            <span className="text-micro font-mono text-ink-500">24px · 32px · 48px sizes</span>
          </div>

          <Card>
            <CardContent className="flex flex-wrap items-center gap-8 py-6">
              <div className="flex flex-col gap-1 items-start">
                <span className="text-micro font-mono text-ink-500">24px height</span>
                <Logo size={24} />
              </div>
              <div className="flex flex-col gap-1 items-start">
                <span className="text-micro font-mono text-ink-500">32px height (Nav default)</span>
                <Logo size={32} />
              </div>
              <div className="flex flex-col gap-1 items-start">
                <span className="text-micro font-mono text-ink-500">48px height (Login brand)</span>
                <Logo size={48} />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ─── 1. Button ────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h2 className="text-h3 font-semibold text-navy-900">1. Button</h2>
            <span className="text-micro font-mono text-ink-500">4 variants · 3 sizes · loading · saffron focus</span>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-6">
              <div>
                <p className="text-small font-medium text-ink-700 mb-3">Variants (size="md"):</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" leftIcon={<Shield className="w-4 h-4" />}>
                    Primary Navy
                  </Button>
                  <Button variant="secondary" leftIcon={<Filter className="w-4 h-4" />}>
                    Secondary Paper
                  </Button>
                  <Button variant="tertiary">Tertiary Ghost</Button>
                  <Button variant="destructive" leftIcon={<Trash2 className="w-4 h-4" />}>
                    Destructive Action
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-small font-medium text-ink-700 mb-3">Sizes (variant="primary"):</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small (32px)</Button>
                  <Button size="md">Medium (40px)</Button>
                  <Button size="lg">Large (48px)</Button>
                </div>
              </div>

              <div>
                <p className="text-small font-medium text-ink-700 mb-3">States:</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button isLoading loadingText="Verifying on-chain…">
                    Loading
                  </Button>
                  <Button disabled>Disabled Button</Button>
                  <Button variant="secondary" rightIcon={<Send className="w-4 h-4" />}>
                    With Right Icon
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ─── 2. Input / Textarea / Select ─────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h2 className="text-h3 font-semibold text-navy-900">2. Form Controls (Input / Textarea / Select)</h2>
            <span className="text-micro font-mono text-ink-500">Labels · Helper texts · Error states · Accessible</span>
          </div>

          <Card>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-4">
                <Input
                  label="Tender Number"
                  placeholder="e.g. GEM/2026/B/88219"
                  helperText="Official GeM procurement identifier"
                  required
                />
                <Input
                  label="Bidder PAN"
                  defaultValue="AAACS1234H"
                  leftIcon={<Search className="w-4 h-4" />}
                />
                <Input
                  label="GSTIN Identification"
                  defaultValue="27AAACS1234H1Z1"
                  error="Invalid state code prefix for Maharashtra entity"
                />
              </div>

              <div className="flex flex-col gap-4">
                <Select
                  label="Evaluation Status Filter"
                  helperText="Filter bidders by current stage"
                  options={[
                    { value: 'all', label: 'All Bidders (15)' },
                    { value: 'qualified', label: 'Qualified (11)' },
                    { value: 'disqualified', label: 'Disqualified (3)' },
                    { value: 'clarification', label: 'Clarification Required (1)' },
                  ]}
                />

                <Select
                  label="Required Compliance Level"
                  error="High-risk category requires Class-3 DSC certification"
                  options={[
                    { value: 'standard', label: 'Standard Procurement' },
                    { value: 'critical', label: 'Critical Security Infrastructure' },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-4">
                <Textarea
                  label="Disqualification Justification"
                  placeholder="State statutory legal grounding and ledger reference…"
                  helperText="Minimum 80 characters required for immutable audit logging"
                  showCharCount
                  maxLength={500}
                  defaultValue="Bidder failed GST active registration cross-check on 23-Sep-2026. MCA director cross-reference shows overlapping control with bidder cluster c2."
                  required
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ─── 3, 4, 5. Badges (Badge, RiskBadge, TrustBadge) ──────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h2 className="text-h3 font-semibold text-navy-900">3, 4, 5. Badges & Indicators</h2>
            <span className="text-micro font-mono text-ink-500">Muted semantic risk · Sovereign trust sources</span>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-6">
              <div>
                <p className="text-small font-medium text-ink-700 mb-3">Generic Badges (Component 3):</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="default">Draft Status</Badge>
                  <Badge variant="success">Compliant</Badge>
                  <Badge variant="warning">Under Review</Badge>
                  <Badge variant="danger">Disqualified</Badge>
                  <Badge variant="info">Primary Officer Approved</Badge>
                </div>
              </div>

              <div>
                <p className="text-small font-medium text-ink-700 mb-3">Risk Badges (Component 4 — 4 tiers + numeric score):</p>
                <div className="flex flex-wrap items-center gap-3">
                  <RiskBadge level="critical" score={0.85} />
                  <RiskBadge level="high" score={0.68} />
                  <RiskBadge level="medium" score={0.45} />
                  <RiskBadge level="low" score={0.12} />
                  <RiskBadge level="low" showLabel={false} score={0.05} />
                </div>
              </div>

              <div>
                <p className="text-small font-medium text-ink-700 mb-3">Trust Badges (Component 5 — 4 sovereign sources with tooltips):</p>
                <div className="flex flex-wrap items-center gap-3">
                  <TrustBadge source="digilocker" />
                  <TrustBadge source="portal_verified" />
                  <TrustBadge source="ai_extracted" confidence={0.94} />
                  <TrustBadge source="ai_extracted" confidence={0.78} />
                  <TrustBadge source="simulated" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ─── 6. Card & 7. Table ───────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h2 className="text-h3 font-semibold text-navy-900">6. Card & 7. Table</h2>
            <div className="flex items-center gap-2">
              <span className="text-micro text-ink-500">Density:</span>
              <Button
                variant={tableDensity === 'normal' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setTableDensity('normal')}
              >
                Normal (56px)
              </Button>
              <Button
                variant={tableDensity === 'compact' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setTableDensity('compact')}
              >
                Compact (44px)
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bidder Evaluation Triage</CardTitle>
                <CardDescription>
                  Live compliance verification results for Tender GEM/2026/B/90184
                </CardDescription>
              </div>
              <Badge variant="info">Evaluation Phase</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table density={tableDensity}>
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Bidder ID / PAN</TableHead>
                    <TableHead>Trust Source</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Last Verified</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow isInteractive>
                    <TableCell className="font-semibold text-ink-900">
                      Acme Defence Supplies Ltd
                    </TableCell>
                    <TableCell>
                      <CopyableId id="AAACA9012J" label="PAN" />
                    </TableCell>
                    <TableCell>
                      <TrustBadge source="digilocker" />
                    </TableCell>
                    <TableCell>
                      <RiskBadge level="low" score={0.08} />
                    </TableCell>
                    <TableCell>
                      <Timestamp date="2026-09-23T12:30:00Z" mode="both" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="secondary" size="sm">
                        View Drawer
                      </Button>
                    </TableCell>
                  </TableRow>

                  <TableRow isInteractive>
                    <TableCell className="font-semibold text-ink-900">
                      Shree Krishna Hardware Corp
                    </TableCell>
                    <TableCell>
                      <CopyableId id="BBBCB4521K" label="PAN" />
                    </TableCell>
                    <TableCell>
                      <TrustBadge source="portal_verified" />
                    </TableCell>
                    <TableCell>
                      <RiskBadge level="medium" score={0.42} />
                    </TableCell>
                    <TableCell>
                      <Timestamp date="2026-09-23T10:15:00Z" mode="both" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="secondary" size="sm">
                        View Drawer
                      </Button>
                    </TableCell>
                  </TableRow>

                  <TableRow isInteractive isSelected>
                    <TableCell className="font-semibold text-ink-900">
                      Vanguard Infotech cluster-c1
                    </TableCell>
                    <TableCell>
                      <CopyableId id="CCCCV8821L" label="PAN" />
                    </TableCell>
                    <TableCell>
                      <TrustBadge source="ai_extracted" confidence={0.88} />
                    </TableCell>
                    <TableCell>
                      <RiskBadge level="critical" score={0.85} />
                    </TableCell>
                    <TableCell>
                      <Timestamp date="2026-09-23T08:00:00Z" mode="both" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm">
                        Triage Flag
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="py-3 bg-cream-50/50">
              <span className="text-micro font-mono text-ink-500">
                Showing 3 of 15 bidders · SHA-256 Ledger sync: 0x9f1a…c84e
              </span>
              <Button variant="secondary" size="sm">
                Next Page →
              </Button>
            </CardFooter>
          </Card>
        </section>

        {/* ─── 8. Timestamp & 9. CopyableId ─────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h2 className="text-h3 font-semibold text-navy-900">8. Timestamp & 9. CopyableId</h2>
            <span className="text-micro font-mono text-ink-500">Monospace standard · Click-to-copy feedback</span>
          </div>

          <Card>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <p className="text-small font-semibold text-ink-700">Timestamp Formats:</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-small">
                    <span className="text-ink-500">Absolute:</span>
                    <Timestamp date="2026-09-23T18:00:00Z" mode="absolute" />
                  </div>
                  <div className="flex items-center justify-between text-small">
                    <span className="text-ink-500">Relative:</span>
                    <Timestamp date="2026-09-23T17:45:00Z" mode="relative" />
                  </div>
                  <div className="flex items-center justify-between text-small">
                    <span className="text-ink-500">Combined:</span>
                    <Timestamp date="2026-09-23T12:00:00Z" mode="both" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-small font-semibold text-ink-700">Copyable IDs (Monospace):</p>
                <div className="flex flex-wrap items-center gap-3">
                  <CopyableId id="AAACS1234H" label="Director PAN" />
                  <CopyableId id="27AAACS1234H1Z1" label="GSTIN" />
                  <CopyableId
                    id="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                    label="Ledger Hash"
                    truncate
                    truncateChars={8}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ─── 11. EmptyState & 12. Skeleton ────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h2 className="text-h3 font-semibold text-navy-900">11. EmptyState & 12. Skeleton</h2>
            <span className="text-micro font-mono text-ink-500">No cartoon vectors · Opacity pulse only</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <EmptyState
              title="No Disqualified Bidders"
              description="All submitted tenders for this cycle currently meet the baseline compliance threshold of 0.60."
              action={
                <Button variant="secondary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                  Simulate Flagged Bidder
                </Button>
              }
            />

            <Card>
              <CardHeader>
                <CardTitle>Skeleton Loading States</CardTitle>
                <CardDescription>Opacity pulse only — zero shimmer/wave gradient</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circle" className="w-10 h-10" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton variant="text" className="w-3/4" />
                    <Skeleton variant="text" className="w-1/2" />
                  </div>
                </div>
                <Skeleton variant="tableRow" />
                <Skeleton variant="tableRow" />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ─── 13, 14, 15, 16. Interactive Modals, Drawer, Tabs, Confirm, Toast */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h2 className="text-h3 font-semibold text-navy-900">
              13. Modal / Drawer, 14. Toast, 15. Tabs, 16. Confirm
            </h2>
            <span className="text-micro font-mono text-ink-500">Interactive live triggers</span>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-8">
              {/* Component 15: Tabs */}
              <div>
                <p className="text-small font-semibold text-ink-700 mb-2">
                  15. Tabs with Underline Active Indicator:
                </p>
                <Tabs defaultValue="compliance">
                  <TabList aria-label="Bidder Tabs">
                    <TabTrigger value="overview">Overview</TabTrigger>
                    <TabTrigger value="compliance" count={5}>
                      Compliance Checks
                    </TabTrigger>
                    <TabTrigger value="trust" badge={<Badge variant="success">98%</Badge>}>
                      Trust Profile
                    </TabTrigger>
                    <TabTrigger value="decisions">Officer Decision</TabTrigger>
                  </TabList>

                  <TabContent value="overview">
                    <div className="p-4 bg-cream-50 rounded border border-line text-small">
                      Overview panel with masked PII: <code className="font-mono">AAACS****H</code>
                    </div>
                  </TabContent>
                  <TabContent value="compliance">
                    <div className="p-4 bg-cream-50 rounded border border-line text-small flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span>MSME Udhyam Certificate:</span>
                        <TrustBadge source="digilocker" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>GST Active Filing:</span>
                        <TrustBadge source="portal_verified" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>MCA Director PAN:</span>
                        <TrustBadge source="ai_extracted" confidence={0.92} />
                      </div>
                    </div>
                  </TabContent>
                  <TabContent value="trust">
                    <div className="p-4 bg-cream-50 rounded border border-line text-small">
                      Trust score dial placeholder: <strong>92 / 100</strong> (Top quartile contractor)
                    </div>
                  </TabContent>
                  <TabContent value="decisions">
                    <div className="p-4 bg-cream-50 rounded border border-line text-small">
                      Anti-anchoring decision input and dual-officer approval pipeline.
                    </div>
                  </TabContent>
                </Tabs>
              </div>

              {/* Triggers for Modal, Drawer, Confirm, and Toast */}
              <div className="pt-4 border-t border-line">
                <p className="text-small font-semibold text-ink-700 mb-3">
                  Live Overlay Triggers:
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
                    Open Modal (13a)
                  </Button>
                  <Button variant="secondary" onClick={() => setIsDrawerOpen(true)}>
                    Open Drawer (13b)
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setIsConfirmOpen(true)}
                  >
                    Open Consequence Confirm (16)
                  </Button>
                </div>
              </div>

              {/* Component 14: Toast notifications */}
              <div className="pt-4 border-t border-line">
                <p className="text-small font-semibold text-ink-700 mb-3">
                  14. Toast Notifications (Sonner Token Wrappers):
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => notify.success('Verification block EVT-401 appended to ledger')}
                  >
                    Success Toast
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      notify.error('Disqualification rejected', {
                        description: 'Second officer review required before status mutation',
                      })
                    }
                  >
                    Error Toast
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      notify.warning('Rate limit reached', {
                        description: 'Too many collusion detections requested. Retry in 60s.',
                      })
                    }
                  >
                    Warning Toast
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => notify.info('PII audit record saved')}
                  >
                    Info Toast
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ─── Modal Instance ──────────────────────────────────────────────── */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Tender Rules Configuration"
          description="Update statutory parameters for procurement cycle 2026-Q3"
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  notify.success('Rules updated successfully')
                  setIsModalOpen(false)
                }}
              >
                Save Changes
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Input label="Collusion Sensitivity Threshold" defaultValue="0.60" helperText="Default 0.60" />
            <Input label="Delivery Grace Days" defaultValue="7" helperText="Standard GeM period" />
            <Select
              label="Audit Ledger Export Format"
              options={[
                { value: 'csv', label: 'CSV Spreadsheets (RFC 4180)' },
                { value: 'pdf', label: 'Cryptographically Signed PDF' },
              ]}
            />
          </div>
        </Modal>

        {/* ─── Drawer Instance ─────────────────────────────────────────────── */}
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title="Acme Defence Supplies Ltd"
          subtitle="Bidder ID: BID-00912 · Registered in Maharashtra"
          badge={<RiskBadge level="low" score={0.08} />}
          footer={
            <div className="w-full flex items-center justify-between">
              <Button variant="secondary" onClick={() => setIsDrawerOpen(false)}>
                Close Drawer
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  notify.success('Bidder approved for Phase 2 technical review')
                  setIsDrawerOpen(false)
                }}
              >
                Approve Qualification
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-6">
            <div className="p-4 rounded-md bg-cream-50 border border-line flex flex-col gap-2">
              <span className="text-micro font-semibold text-ink-700 uppercase tracking-wider">
                Sovereign Trust Verification Summary
              </span>
              <div className="flex items-center gap-2">
                <TrustBadge source="digilocker" />
                <TrustBadge source="portal_verified" />
                <Badge variant="success">All 5 Mandatory Checks Passed</Badge>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-small font-semibold text-ink-900">Statutory Registrations</h4>
              <div className="grid grid-cols-2 gap-3 text-small">
                <div className="p-3 rounded border border-line bg-paper">
                  <p className="text-micro text-ink-500">Corporate PAN</p>
                  <CopyableId id="AAACS9981J" />
                </div>
                <div className="p-3 rounded border border-line bg-paper">
                  <p className="text-micro text-ink-500">GSTIN Identifier</p>
                  <CopyableId id="27AAACS9981J1Z2" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-small font-semibold text-ink-900">Audited Compliance Documents</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded border border-line bg-paper">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-risk-low" />
                    <span className="text-small font-medium">MSME Udyam Certificate.pdf</span>
                  </div>
                  <TrustBadge source="digilocker" />
                </div>
                <div className="flex items-center justify-between p-3 rounded border border-line bg-paper">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-risk-low" />
                    <span className="text-small font-medium">GSTR-3B Tax Filing (Aug 2026).pdf</span>
                  </div>
                  <TrustBadge source="portal_verified" />
                </div>
              </div>
            </div>
          </div>
        </Drawer>

        {/* ─── Confirm Instance ────────────────────────────────────────────── */}
        <Confirm
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={() => {
            notify.error('Bidder cluster marked as disqualified on ledger')
            setIsConfirmOpen(false)
          }}
          title="Disqualify Bidder Cluster"
          actionName="disqualification"
          consequence="append event EVT-DISQ to the immutable SHA-256 trust ledger and trigger disqualification notice to 3 cartel entities"
          description="This action requires primary officer authorization. Once committed to the chain, the outcome cannot be modified without second-officer appeal."
          confirmText="Confirm Disqualification"
          isDestructive
        />
      </div>
    </div>
  )
}
