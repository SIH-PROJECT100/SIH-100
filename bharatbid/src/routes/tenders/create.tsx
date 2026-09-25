import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FilePlus,
  ArrowLeft,
  IndianRupee,
  Calendar,
  Tag,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react'
import apiClient from '@/lib/apiClient'
import {
  PageHeader,
  Button,
  Input,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from '@/components/ui'
import { toast } from 'sonner'

export default function CreateTenderPage() {
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [applicationFee, setApplicationFee] = useState('')
  const [emdAmount, setEmdAmount] = useState('')
  const [closingDate, setClosingDate] = useState('')
  const [criteria, setCriteria] = useState<string[]>(['MSME Certification', 'GST Registration', 'ITR Filing'])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const addCriterion = () => setCriteria((prev) => [...prev, ''])

  const updateCriterion = (idx: number, val: string) =>
    setCriteria((prev) => prev.map((c, i) => (i === idx ? val : c)))

  const removeCriterion = (idx: number) =>
    setCriteria((prev) => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    if (!title.trim() || title.trim().length < 5) {
      toast.error('Tender title must be at least 5 characters')
      return
    }

    const appFee = applicationFee ? Number(applicationFee) : 0
    const emd = emdAmount ? Number(emdAmount) : 0

    if (isNaN(appFee) || appFee < 0) {
      toast.error('Application fee must be a non-negative number')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        applicationFee: appFee,
        emdAmount: emd,
        closingDate: closingDate ? new Date(closingDate).toISOString() : undefined,
        evaluationCriteria: criteria.filter((c) => c.trim()),
      }

      const res = await apiClient.post<{ id: string; gemTenderId: string }>('/tenders', payload)
      const tender = res.data as any
      const tenderId = tender?.id
      const gemId = tender?.gemTenderId

      toast.success(`Tender created — ${gemId}`)
      if (tenderId) {
        navigate(`/tenders/${tenderId}`)
      } else {
        navigate('/tenders')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to create tender'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 flex flex-col gap-6">
      <PageHeader
        title="Create New Tender"
        subtitle="Draft a new government procurement tender for the GeM portal"
        onBack={() => navigate('/tenders')}
        breadcrumbs={[
          { label: 'BharatBid', href: '/tenders' },
          { label: 'Tenders', href: '/tenders' },
          { label: 'Create Tender' },
        ]}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-navy-900">
            <FilePlus className="w-5 h-5" />
            <span className="text-body font-semibold">Tender Details</span>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tender-title" className="text-small font-medium text-navy-900">
              Tender Title <span className="text-risk-critical">*</span>
            </label>
            <Input
              id="tender-title"
              placeholder="e.g. Procurement of IT Hardware and Peripherals 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
            />
            <span className="text-micro text-ink-500">{title.length}/300 characters</span>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tender-description" className="text-small font-medium text-navy-900">
              Description
            </label>
            <textarea
              id="tender-description"
              rows={4}
              placeholder="Detailed scope of work, technical specifications, and other relevant details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              className="w-full rounded-md border border-line bg-paper text-ink-900 text-small px-3 py-2 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition-colors resize-none"
            />
          </div>

          {/* Category + Application Fee row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tender-category" className="text-small font-medium text-navy-900 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Category
              </label>
              <Input
                id="tender-category"
                placeholder="e.g. IT Hardware, Office Supplies, Infrastructure"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="tender-fee" className="text-small font-medium text-navy-900 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5" /> Application Fee (₹)
              </label>
              <Input
                id="tender-fee"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={applicationFee}
                onChange={(e) => setApplicationFee(e.target.value)}
              />
            </div>
          </div>

          {/* EMD + Closing Date row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tender-emd" className="text-small font-medium text-navy-900 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5" /> EMD Amount (₹)
              </label>
              <Input
                id="tender-emd"
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                value={emdAmount}
                onChange={(e) => setEmdAmount(e.target.value)}
              />
              <span className="text-micro text-ink-500">Earnest Money Deposit</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="tender-closing" className="text-small font-medium text-navy-900 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Closing Date & Time
              </label>
              <Input
                id="tender-closing"
                type="datetime-local"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          </div>

          {/* Evaluation Criteria */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-small font-medium text-navy-900">
                Evaluation Criteria
              </label>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={addCriterion}
                type="button"
              >
                Add Criterion
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {criteria.map((criterion, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder={`Criterion ${idx + 1}`}
                    value={criterion}
                    onChange={(e) => updateCriterion(idx, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => removeCriterion(idx)}
                    aria-label="Remove criterion"
                    type="button"
                  >
                    <Trash2 className="w-4 h-4 text-risk-critical" />
                  </Button>
                </div>
              ))}
              {criteria.length === 0 && (
                <p className="text-small text-ink-500 italic p-3 bg-cream-50 rounded border border-line">
                  No criteria added. Click "Add Criterion" above.
                </p>
              )}
            </div>
          </div>

          {/* Preview strip */}
          <div className="p-3 bg-cream-100 rounded-md border border-line text-small text-ink-700">
            <p className="font-semibold text-navy-900 mb-1">Before publishing:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>GEM Tender ID will be auto-generated (e.g. GEM/2026/B/1234567)</li>
              <li>Status will be set to <strong>Open</strong> immediately</li>
              <li>All creation events are logged to the immutable Trust Ledger</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between border-t border-line pt-4">
          <Button
            variant="secondary"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/tenders')}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            loadingText="Creating Tender…"
            onClick={handleSubmit}
            rightIcon={<CheckCircle2 className="w-4 h-4" />}
            id="create-tender-submit-btn"
          >
            Publish Tender
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
