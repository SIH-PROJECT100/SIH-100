import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-micro text-ink-500 font-mono mb-2">404</p>
        <h1 className="text-h1 font-semibold text-ink-900">Page not found</h1>
        <p className="text-ink-500 text-body mt-2">The route you're looking for doesn't exist.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-navy-900 text-paper rounded-md text-small hover:bg-navy-700 transition-color"
        >
          Return home
        </button>
      </div>
    </div>
  )
}
