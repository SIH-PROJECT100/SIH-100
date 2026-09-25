// Utility pages
import { useNavigate } from 'react-router-dom'

export function UnauthorizedPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-h1 font-semibold text-ink-900">Access Denied</h1>
        <p className="text-ink-500 text-body mt-2">You don't have permission to view this page.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-navy-900 text-paper rounded-md text-small hover:bg-navy-700 transition-color"
        >
          Go back
        </button>
      </div>
    </div>
  )
}

export default UnauthorizedPage
