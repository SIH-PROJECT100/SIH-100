import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  IndianRupee,
  FileCheck2,
  Trash2,
  RotateCcw,
} from 'lucide-react'
import apiClient from '@/lib/apiClient'
import type { Tender } from '@/types'
import {
  PageHeader,
  Button,
  Input,
  Badge,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from '@/components/ui'
import { toast } from 'sonner'

interface UploadItem {
  docType: 'pan' | 'gst' | 'udyam'
  file: File
  uploadId?: string
  progress: number
  status: 'idle' | 'uploading' | 'success' | 'error'
  error?: string
  previewUrl?: string
}

export default function BidderApplyPage() {
  const { tenderId } = useParams<{ tenderId: string }>()
  const navigate = useNavigate()

  const [step, setStep] = useState<number>(1)

  // Step 1: Company details
  const [companyName, setCompanyName] = useState('')
  const [pan, setPan] = useState('')
  const [gstin, setGstin] = useState('')
  const [udyam, setUdyam] = useState('')
  const [isMsme, setIsMsme] = useState<boolean>(true)

  // Step 2, 3, 4: Uploads
  const [panUpload, setPanUpload] = useState<UploadItem | null>(null)
  const [gstUpload, setGstUpload] = useState<UploadItem | null>(null)
  const [udyamUpload, setUdyamUpload] = useState<UploadItem | null>(null)

  // Step 5: Pricing
  const [basePrice, setBasePrice] = useState<string>('')
  const [gstPercent, setGstPercent] = useState<string>('18')

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submittedBidderId, setSubmittedBidderId] = useState<string | null>(null)

  // Fetch tender info
  const { data: tender } = useQuery<Tender>({
    queryKey: ['tender', tenderId],
    queryFn: async () => {
      const res = await apiClient.get<Tender>(`/tenders/${tenderId}`)
      return res.data
    },
    enabled: !!tenderId,
  })

  // Upload handler with progress
  const handleUploadFile = async (
    file: File,
    docType: 'pan' | 'gst' | 'udyam',
    setter: React.Dispatch<React.SetStateAction<UploadItem | null>>
  ) => {
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    const item: UploadItem = {
      docType,
      file,
      progress: 10,
      status: 'uploading',
      previewUrl,
    }
    setter(item)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('docType', docType)

    try {
      const res = await apiClient.post<{ uploadId: string; url: string; sha256: string }>(
        '/uploads',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || 1
            const pct = Math.round((progressEvent.loaded * 100) / total)
            setter((prev) => (prev ? { ...prev, progress: Math.min(pct, 95) } : null))
          },
        }
      )

      setter((prev) =>
        prev
          ? {
              ...prev,
              uploadId: res.data.uploadId,
              progress: 100,
              status: 'success',
            }
          : null
      )
      toast.success(`${docType.toUpperCase()} document uploaded successfully`)
    } catch (err: any) {
      setter((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              error: err.message || 'Upload failed',
            }
          : null
      )
      toast.error(`Failed to upload ${docType.toUpperCase()}: ${err.message || 'Server error'}`)
    }
  }

  // Calculate quoted total price
  const baseNum = Number(basePrice) || 0
  const gstNum = Number(gstPercent) || 0
  const totalQuotedPrice = baseNum * (1 + gstNum / 100)

  // Submit Bid
  const handleSubmitBid = async () => {
    if (!panUpload?.uploadId) {
      toast.error('PAN Card document is required')
      setStep(2)
      return
    }

    if (!gstUpload?.uploadId) {
      toast.error('GST Certificate document is required')
      setStep(3)
      return
    }

    if (isMsme && !udyamUpload?.uploadId) {
      toast.error('Udyam Certificate is required for MSME entities (or check Not MSME)')
      setStep(4)
      return
    }

    if (baseNum <= 0) {
      toast.error('Please enter a valid base price')
      setStep(5)
      return
    }

    setIsSubmitting(true)
    try {
      const uploadsList = [
        { docType: 'pan', uploadId: panUpload.uploadId },
        { docType: 'gst', uploadId: gstUpload.uploadId },
        ...(isMsme && udyamUpload?.uploadId
          ? [{ docType: 'udyam', uploadId: udyamUpload.uploadId }]
          : []),
      ]

      const payload = {
        companyName: companyName.trim() || undefined,
        pan: pan.trim().toUpperCase(),
        gstin: gstin.trim() ? gstin.trim().toUpperCase() : null,
        udyam: isMsme && udyam.trim() ? udyam.trim().toUpperCase() : null,
        itrYear: '2024-25',
        basePrice: baseNum,
        gstPercent: gstNum,
        uploads: uploadsList,
      }

      const res = await apiClient.post<any>(`/tenders/${tenderId}/bids`, payload)
      setSubmittedBidderId(res.data?.id || null)
      setIsSubmitted(true)
      toast.success('Bid and compliance verification documents submitted successfully!')
    } catch (err: any) {
      toast.error(`Bid submission error: ${err.message || 'Failed to submit'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Success Screen ──────────────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 text-center">
        <div className="p-6 bg-paper rounded-xl border border-line shadow-md flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-teal-600" />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-h2 font-semibold text-navy-900">
              Bid Submitted Successfully!
            </h2>
            <p className="text-body text-ink-700 max-w-md mx-auto leading-relaxed">
              Your bid proposal and statutory verification documents have been securely committed to the
              immutable Trust Ledger.
            </p>
            {submittedBidderId && (
              <div className="text-micro font-mono text-ink-600 bg-cream-50 px-3 py-1.5 rounded border border-line">
                Bidder Reference ID: {submittedBidderId}
              </div>
            )}
            <div className="mt-2 p-3 bg-cream-100 rounded-md border border-line text-small font-medium text-navy-900 inline-block">
              You will be notified within 24 hours once statutory verification completes.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center pt-4">
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/bidder')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Go to Bidder Vault
            </Button>
            <Link to={`/tenders/${tenderId}`}>
              <Button variant="secondary" size="md">
                View Tender Overview
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 flex flex-col gap-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Submit Tender Bid Proposal"
        subtitle={`Application for ${tender?.title || 'Procurement Tender'} (${tender?.gemTenderId || ''})`}
        breadcrumbs={[
          { label: 'BharatBid', href: '/bidder' },
          { label: 'Tenders', href: '/tenders' },
          { label: 'Bid Submission Wizard' },
        ]}
      />

      {/* ─── Wizard Progress Stepper ────────────────────────────────────────── */}
      <div className="bg-paper p-4 rounded-lg border border-line shadow-sm">
        <div className="flex items-center justify-between text-micro font-medium text-ink-600">
          {[
            { n: 1, label: 'Company Info' },
            { n: 2, label: 'PAN Card' },
            { n: 3, label: 'GSTIN Cert' },
            { n: 4, label: 'MSME Udyam' },
            { n: 5, label: 'Commercial' },
            { n: 6, label: 'Review' },
          ].map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={() => s.n < step && setStep(s.n)}
              disabled={s.n > step}
              className={`flex items-center gap-1.5 transition-colors ${
                step === s.n
                  ? 'text-navy-900 font-semibold'
                  : s.n < step
                  ? 'text-teal-700 hover:underline cursor-pointer'
                  : 'text-ink-400 cursor-not-allowed'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-micro ${
                  step === s.n
                    ? 'bg-navy-900 text-white font-bold'
                    : s.n < step
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-cream-100 text-ink-400'
                }`}
              >
                {s.n < step ? '✓' : s.n}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Step Content ───────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        {/* Step 1: Company Details */}
        {step === 1 && (
          <div>
            <CardHeader>
              <h3 className="text-h3 font-semibold text-navy-900">Step 1: Enterprise Identification</h3>
              <p className="text-small text-ink-600 mt-1">
                Enter your statutory entity credentials as registered with the Ministry of Corporate Affairs and GeM.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Input
                label="Legal Enterprise Name"
                placeholder="Apex Technologies Pvt Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Corporate / Proprietor PAN (10 chars)"
                  placeholder="AABCA1234E"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  maxLength={10}
                  required
                />

                <Input
                  label="GSTIN Identifier (15 chars)"
                  placeholder="07AABCA1234E1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  maxLength={15}
                  required
                />
              </div>

              <div className="pt-2 border-t border-line">
                <div className="flex items-center justify-between">
                  <label className="text-small font-medium text-navy-900">MSME / Udyam Enterprise Status</label>
                  <label className="flex items-center gap-2 text-small text-ink-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMsme}
                      onChange={(e) => setIsMsme(e.target.checked)}
                      className="rounded border-line text-navy-900 focus:ring-saffron-500"
                    />
                    <span>Registered MSME Entity</span>
                  </label>
                </div>

                {isMsme && (
                  <div className="mt-3">
                    <Input
                      label="Udyam Registration Number"
                      placeholder="UDYAM-DL-01-0099887"
                      value={udyam}
                      onChange={(e) => setUdyam(e.target.value.toUpperCase())}
                      required={isMsme}
                    />
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-line pt-4">
              <div />
              <Button
                variant="primary"
                onClick={() => {
                  if (!pan || pan.length !== 10) {
                    toast.error('Please enter a valid 10-character PAN')
                    return
                  }
                  if (!gstin || gstin.length !== 15) {
                    toast.error('Please enter a valid 15-character GSTIN')
                    return
                  }
                  if (isMsme && (!udyam || !udyam.startsWith('UDYAM-'))) {
                    toast.error('Please enter a valid Udyam number (e.g. UDYAM-XX-00-0000000)')
                    return
                  }
                  setStep(2)
                }}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to PAN Upload
              </Button>
            </CardFooter>
          </div>
        )}

        {/* Step 2: Upload PAN Card */}
        {step === 2 && (
          <div>
            <CardHeader>
              <h3 className="text-h3 font-semibold text-navy-900">Step 2: Upload PAN Card Document</h3>
              <p className="text-small text-ink-600 mt-1">
                Upload the original or DigiLocker certified PDF/Image copy of your PAN Card for AI extraction and validity verification.
              </p>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                docType="pan"
                title="PAN Card (PDF, JPG, PNG up to 5MB)"
                currentUpload={panUpload}
                onFileSelected={(file) => handleUploadFile(file, 'pan', setPanUpload)}
                onRemove={() => setPanUpload(null)}
              />
            </CardContent>
            <CardFooter className="flex justify-between border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setStep(1)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back
              </Button>
              <Button
                variant="primary"
                disabled={!panUpload?.uploadId || panUpload.status !== 'success'}
                onClick={() => setStep(3)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to GST Upload
              </Button>
            </CardFooter>
          </div>
        )}

        {/* Step 3: Upload GST Certificate */}
        {step === 3 && (
          <div>
            <CardHeader>
              <h3 className="text-h3 font-semibold text-navy-900">Step 3: Upload GST Registration Certificate</h3>
              <p className="text-small text-ink-600 mt-1">
                Upload Form GST REG-06 showing principal place of business and GSTIN verification.
              </p>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                docType="gst"
                title="GST Registration Certificate (Form GST REG-06)"
                currentUpload={gstUpload}
                onFileSelected={(file) => handleUploadFile(file, 'gst', setGstUpload)}
                onRemove={() => setGstUpload(null)}
              />
            </CardContent>
            <CardFooter className="flex justify-between border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setStep(2)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back
              </Button>
              <Button
                variant="primary"
                disabled={!gstUpload?.uploadId || gstUpload.status !== 'success'}
                onClick={() => setStep(isMsme ? 4 : 5)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isMsme ? 'Continue to MSME Upload' : 'Continue to Pricing'}
              </Button>
            </CardFooter>
          </div>
        )}

        {/* Step 4: Upload Udyam Certificate (Skippable if Not MSME) */}
        {step === 4 && (
          <div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-h3 font-semibold text-navy-900">Step 4: Upload MSME Udyam Certificate</h3>
                  <p className="text-small text-ink-600 mt-1">
                    Upload official Udyam Registration Certificate for EMD exemption and procurement preference.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-micro text-ink-600 bg-cream-100 p-2 rounded border border-line cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!isMsme}
                    onChange={(e) => setIsMsme(!e.target.checked)}
                  />
                  <span>Skip (Not MSME)</span>
                </label>
              </div>
            </CardHeader>
            <CardContent>
              {isMsme ? (
                <FileUploadZone
                  docType="udyam"
                  title="MSME Udyam Registration Certificate"
                  currentUpload={udyamUpload}
                  onFileSelected={(file) => handleUploadFile(file, 'udyam', setUdyamUpload)}
                  onRemove={() => setUdyamUpload(null)}
                />
              ) : (
                <div className="p-6 bg-cream-50 border border-line rounded-lg text-center text-ink-600">
                  <p className="text-small">
                    MSME verification is skipped. This bidder will be evaluated under general procurement terms.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setStep(3)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back
              </Button>
              <Button
                variant="primary"
                disabled={isMsme && (!udyamUpload?.uploadId || udyamUpload.status !== 'success')}
                onClick={() => setStep(5)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Pricing
              </Button>
            </CardFooter>
          </div>
        )}

        {/* Step 5: Commercial Bid Pricing */}
        {step === 5 && (
          <div>
            <CardHeader>
              <h3 className="text-h3 font-semibold text-navy-900">Step 5: Commercial Quote Pricing</h3>
              <p className="text-small text-ink-600 mt-1">
                State your financial commercial proposal including base price and applicable GST tax rate.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Base Quoted Price (₹ Excluding GST)"
                  type="number"
                  placeholder="5000000"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  leftIcon={<IndianRupee className="w-4 h-4 text-ink-500" />}
                  required
                />

                <Input
                  label="GST Rate (%)"
                  type="number"
                  placeholder="18"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(e.target.value)}
                  required
                />
              </div>

              {/* Price Calculation Card */}
              <div className="p-4 bg-cream-100/70 border border-line rounded-lg flex flex-col gap-2">
                <span className="text-micro font-mono uppercase text-ink-600">Commercial Summary</span>
                <div className="flex items-center justify-between text-small text-ink-700">
                  <span>Base Price:</span>
                  <span className="font-mono font-medium">₹{baseNum.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-small text-ink-700">
                  <span>GST ({gstNum}%):</span>
                  <span className="font-mono font-medium">₹{((baseNum * gstNum) / 100).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-line text-body font-semibold text-navy-900">
                  <span>Total Quoted Commercial Bid:</span>
                  <span className="font-mono text-h3 text-navy-900">₹{totalQuotedPrice.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setStep(isMsme ? 4 : 3)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back
              </Button>
              <Button
                variant="primary"
                disabled={baseNum <= 0}
                onClick={() => setStep(6)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Review & Confirm
              </Button>
            </CardFooter>
          </div>
        )}

        {/* Step 6: Review & Final Submit */}
        {step === 6 && (
          <div>
            <CardHeader>
              <h3 className="text-h3 font-semibold text-navy-900">Step 6: Review Proposal & Submit</h3>
              <p className="text-small text-ink-600 mt-1">
                Confirm your submitted details. Submitting triggers real-time multi-tier statutory verification and appends this bid to the Trust Ledger.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="p-4 bg-cream-50 rounded-lg border border-line grid grid-cols-1 sm:grid-cols-2 gap-3 text-small">
                <div>
                  <span className="text-micro text-ink-500 block">Legal Entity Name</span>
                  <span className="font-medium text-navy-900">{companyName || 'Not specified'}</span>
                </div>
                <div>
                  <span className="text-micro text-ink-500 block">PAN Identifier</span>
                  <span className="font-mono font-medium text-navy-900">{pan}</span>
                </div>
                <div>
                  <span className="text-micro text-ink-500 block">GSTIN</span>
                  <span className="font-mono font-medium text-navy-900">{gstin}</span>
                </div>
                <div>
                  <span className="text-micro text-ink-500 block">MSME Udyam</span>
                  <span className="font-mono font-medium text-navy-900">{isMsme ? udyam : 'Non-MSME'}</span>
                </div>
                <div>
                  <span className="text-micro text-ink-500 block">Total Quoted Bid</span>
                  <span className="font-mono font-semibold text-navy-900">₹{totalQuotedPrice.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-micro text-ink-500 block">Tender ID</span>
                  <span className="font-mono text-ink-700">{tender?.gemTenderId || tenderId}</span>
                </div>
              </div>

              {/* Uploaded Documents Review List */}
              <div className="flex flex-col gap-2">
                <span className="text-micro font-medium text-ink-600 uppercase tracking-wider">Uploaded Documents Ready for Verification:</span>
                <div className="flex flex-col gap-2">
                  {panUpload && (
                    <div className="flex items-center justify-between p-2.5 bg-paper rounded border border-line text-small">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-teal-600" />
                        <span className="font-medium">PAN Card:</span>
                        <span className="text-ink-600 text-micro">{panUpload.file.name}</span>
                      </div>
                      <Badge variant="success">Uploaded</Badge>
                    </div>
                  )}

                  {gstUpload && (
                    <div className="flex items-center justify-between p-2.5 bg-paper rounded border border-line text-small">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-teal-600" />
                        <span className="font-medium">GST Certificate:</span>
                        <span className="text-ink-600 text-micro">{gstUpload.file.name}</span>
                      </div>
                      <Badge variant="success">Uploaded</Badge>
                    </div>
                  )}

                  {isMsme && udyamUpload && (
                    <div className="flex items-center justify-between p-2.5 bg-paper rounded border border-line text-small">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-teal-600" />
                        <span className="font-medium">Udyam MSME Certificate:</span>
                        <span className="text-ink-600 text-micro">{udyamUpload.file.name}</span>
                      </div>
                      <Badge variant="success">Uploaded</Badge>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-cream-100 rounded text-micro text-ink-700 border border-line/70">
                <p>
                  <strong>Sovereign Governance Guarantee:</strong> By submitting, your uploaded documents will be processed by our multi-tier verification engine. All evaluation actions and decision records are permanently stored on the immutable Trust Ledger.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setStep(5)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Pricing
              </Button>
              <Button
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                loadingText="Submitting & Verifying…"
                onClick={handleSubmitBid}
                rightIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Submit Bid Proposal
              </Button>
            </CardFooter>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── File Upload Drag-Drop Component ──────────────────────────────────────────
function FileUploadZone({
  title,
  currentUpload,
  onFileSelected,
  onRemove,
}: {
  docType?: string
  title: string
  currentUpload: UploadItem | null
  onFileSelected: (file: File) => void
  onRemove: () => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelected(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-small font-medium text-navy-900">{title}</span>

      {currentUpload ? (
        <div className="p-4 bg-paper rounded-lg border border-line flex flex-col gap-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentUpload.previewUrl ? (
                <img
                  src={currentUpload.previewUrl}
                  alt="Document Preview"
                  className="w-12 h-12 rounded object-cover border border-line"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-cream-100 border border-line flex items-center justify-center">
                  <FileText className="w-6 h-6 text-navy-900" />
                </div>
              )}
              <div>
                <div className="text-small font-medium text-navy-900">{currentUpload.file.name}</div>
                <div className="text-micro text-ink-500 font-mono">
                  {(currentUpload.file.size / 1024).toFixed(1)} KB · {currentUpload.status.toUpperCase()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentUpload.status === 'success' && <Badge variant="success">Uploaded</Badge>}
              {currentUpload.status === 'error' && <Badge variant="danger">Failed</Badge>}
              <Button variant="secondary" size="sm" onClick={onRemove} aria-label="Remove File">
                <Trash2 className="w-4 h-4 text-risk-critical" />
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          {currentUpload.status === 'uploading' && (
            <div className="w-full bg-cream-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-navy-900 h-full transition-all duration-200"
                style={{ width: `${currentUpload.progress}%` }}
              />
            </div>
          )}

          {/* Error retry */}
          {currentUpload.status === 'error' && (
            <div className="flex items-center justify-between text-micro text-risk-critical bg-[#FAECEB] p-2 rounded border border-[#EFC2BF]">
              <span>{currentUpload.error || 'Upload error'}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onFileSelected(currentUpload.file)}
                leftIcon={<RotateCcw className="w-3 h-3" />}
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragOver ? 'border-navy-900 bg-cream-100' : 'border-line hover:border-ink-400 bg-cream-50/50'
          }`}
        >
          <UploadCloud className="w-10 h-10 text-ink-400 mb-2" />
          <span className="text-small font-medium text-navy-900">
            Click to browse or drag & drop document
          </span>
          <span className="text-micro text-ink-500 mt-1">
            Supports PDF, JPG, PNG up to 5MB
          </span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onFileSelected(e.target.files[0])
              }
            }}
          />
        </label>
      )}
    </div>
  )
}
