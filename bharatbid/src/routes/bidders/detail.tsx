import { useParams, useNavigate } from 'react-router-dom'
import { BidderDetailDrawer } from '@/components/BidderDetailDrawer'

export default function BidderDetailPage() {
  const { bidderId } = useParams<{ bidderId: string }>()
  const navigate = useNavigate()

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <BidderDetailDrawer
        bidderId={bidderId || null}
        isOpen={true}
        onClose={() => navigate(-1)}
      />
    </div>
  )
}
