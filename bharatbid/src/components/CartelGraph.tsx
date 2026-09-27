import { useMemo, useState } from 'react'
import type { CollusionCluster, Bidder } from '@/types'
import { RiskBadge } from '@/components/ui'
import { AlertOctagon, Network, Building2, User, Globe } from 'lucide-react'

export interface CartelGraphProps {
  cluster?: CollusionCluster | null
  bidders: Bidder[]
  onSelectBidder: (bidderId: string) => void
  /** When false, company names are masked as Bidder-<last4PAN> to protect PII */
  piiRevealed?: boolean
}

export function CartelGraph({ cluster, bidders, onSelectBidder, piiRevealed = false }: CartelGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  /** Returns the display label for a bidder. Masks to Bidder-<last4PAN> unless PII is revealed. */
  const displayName = (b: Bidder): string => {
    if (piiRevealed) return b.companyName
    const pan = b.pan || ''
    const suffix = pan.length >= 4 ? pan.slice(-4) : pan.padStart(4, 'X').slice(-4)
    return `Bidder-${suffix}`
  }

  // Map of bidders by ID
  const bidderMap = useMemo(() => {
    const map = new Map<string, Bidder>()
    bidders.forEach((b) => map.set(b.id, b))
    return map
  }, [bidders])

  // Nodes and links for the cartel cluster
  const graphData = useMemo(() => {
    if (!cluster || !cluster.bidderIds || cluster.bidderIds.length === 0) {
      return null
    }

    const clusterBidders = cluster.bidderIds.map((id) => bidderMap.get(id)).filter(Boolean) as Bidder[]

    // Coordinates layout in a triangle / star arrangement
    const centerX = 300
    const centerY = 240
    const radius = 150

    const bidderNodes = clusterBidders.map((b, i) => {
      const angle = (i * 2 * Math.PI) / clusterBidders.length - Math.PI / 2
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      const pan = b.pan || ''
      const suffix = pan.length >= 4 ? pan.slice(-4) : pan.padStart(4, 'X').slice(-4)
      return {
        id: b.id,
        label: piiRevealed ? b.companyName : `Bidder-${suffix}`,
        type: 'bidder' as const,
        x,
        y,
        risk: b.overallRisk,
        score: b.riskScore,
      }
    })

    // Central shared attribute nodes
    const sharedDirector = {
      id: 'shared-director',
      label: 'Shared Director PAN (S1)',
      sub: 'PAN: ABCDP1234D',
      type: 'director' as const,
      x: centerX,
      y: centerY - 20,
    }

    const sharedIp = {
      id: 'shared-ip',
      label: 'Same /24 IP Subnet (S4)',
      sub: '103.21.58.0/24',
      type: 'ip' as const,
      x: centerX - 60,
      y: centerY + 50,
    }

    const sharedAddress = {
      id: 'shared-address',
      label: 'Fuzzy Address ≥ 0.90 (S2)',
      sub: 'Andheri East, Mumbai',
      type: 'address' as const,
      x: centerX + 60,
      y: centerY + 50,
    }

    return {
      bidderNodes,
      attributeNodes: [sharedDirector, sharedIp, sharedAddress],
    }
  }, [cluster, bidderMap])

  if (!cluster || !graphData) {
    return (
      <div className="p-12 text-center bg-paper rounded-lg border border-line">
        <Network className="w-10 h-10 text-ink-300 mx-auto mb-3" />
        <h4 className="text-h3 font-semibold text-ink-900">No Bidding Rings or Coordinated Groups Detected</h4>
        <p className="text-small text-ink-500 max-w-md mx-auto mt-1">
          Click "Detect Collusion" to check whether any competing bidders are secretly working together or fixing prices.
        </p>
      </div>
    )
  }

  const signalLabels: Record<string, string> = {
    shared_director_pan: 'S1: Common Director PAN',
    shared_address: 'S2: Address Similarity ≥ 90%',
    sequential_pan_issuance: 'S3: Sequential PAN Proximity',
    sequential_submissions: 'S4: Same IP Subnet / Fast Sequence',
    price_clustering: 'S5: Price CoV ≤ 1.4%',
    identical_templates: 'S6: Identical Document Hash',
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ─── Interactive SVG Network Graph ───────────────────────────── */}
      <div className="flex-1 bg-paper rounded-lg border border-line p-4 shadow-sm flex flex-col items-center">
        <div className="w-full flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-risk-critical animate-ping" />
            <h3 className="text-small font-semibold text-ink-900">
              Bidding Ring &amp; Network Map (3 Connected Companies)
            </h3>
          </div>
          <span className="text-micro font-mono text-risk-critical bg-[#FAECEB] px-2 py-0.5 rounded border border-[#EFC2BF]">
            Score: {(cluster.aggregateScore * 100).toFixed(0)}% (Threshold: 60%)
          </span>
        </div>

        <svg
          viewBox="0 0 600 480"
          className="w-full max-w-[600px] h-auto my-2 select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Cartel Cluster Halo */}
          <circle
            cx="300"
            cy="240"
            r="190"
            fill="#FAECEB"
            fillOpacity="0.45"
            stroke="#EFC2BF"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Links between Bidders and Shared Attributes */}
          {graphData.bidderNodes.map((bNode) => (
            <g key={`links-${bNode.id}`}>
              {graphData.attributeNodes.map((aNode) => (
                <line
                  key={`${bNode.id}-${aNode.id}`}
                  x1={bNode.x}
                  y1={bNode.y}
                  x2={aNode.x}
                  y2={aNode.y}
                  stroke="#C25B2E"
                  strokeWidth="1.5"
                  strokeOpacity="0.6"
                />
              ))}
            </g>
          ))}

          {/* Attribute Nodes in center */}
          {graphData.attributeNodes.map((node) => (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <circle r="18" fill="#FFFFFF" stroke="#0F2942" strokeWidth="1.5" />
              {node.type === 'director' && (
                <User className="w-4 h-4 text-navy-900 -translate-x-2 -translate-y-2" />
              )}
              {node.type === 'ip' && (
                <Globe className="w-4 h-4 text-navy-900 -translate-x-2 -translate-y-2" />
              )}
              {node.type === 'address' && (
                <Building2 className="w-4 h-4 text-navy-900 -translate-x-2 -translate-y-2" />
              )}
              <text
                y="30"
                textAnchor="middle"
                className="text-[10px] font-medium fill-ink-700 font-ui"
              >
                {node.label}
              </text>
              <text
                y="42"
                textAnchor="middle"
                className="text-[9px] fill-ink-500 font-mono"
              >
                {node.sub}
              </text>
            </g>
          ))}

          {/* Bidder Nodes on perimeter */}
          {graphData.bidderNodes.map((node) => {
            const isSelected = selectedNode === node.id

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => {
                  setSelectedNode(node.id)
                  onSelectBidder(node.id)
                }}
                className="cursor-pointer"
              >
                <circle
                  r={isSelected ? 26 : 22}
                  fill="#FFFFFF"
                  stroke="#A3372E"
                  strokeWidth={isSelected ? 3 : 2}
                  className="transition-all"
                />
                <Building2 className="w-5 h-5 text-risk-critical -translate-x-2.5 -translate-y-2.5" />
                <rect
                  x="-70"
                  y="26"
                  width="140"
                  height="22"
                  rx="4"
                  fill="#FFFFFF"
                  stroke="#E5DDD1"
                  strokeWidth="1"
                />
                <text
                  y="40"
                  textAnchor="middle"
                  className="text-[11px] font-semibold fill-ink-900 font-ui"
                >
                  {node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label}
                </text>
              </g>
            )
          })}
        </svg>

        <p className="text-micro text-ink-500 text-center font-mono">
          Click any company node above to inspect full dossier in drawer
        </p>
      </div>

      {/* ─── Fired Signals & Dossier Panel ───────────────────────────── */}
      <div className="w-full lg:w-96 flex flex-col gap-4">
        <div className="p-4 bg-paper rounded-lg border border-line shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2 text-risk-critical">
            <AlertOctagon className="w-5 h-5" />
            <h4 className="text-small font-semibold">Collusion Risk Verdict</h4>
          </div>

          <p className="text-small text-ink-700 leading-normal">
            A high-confidence coordinated group was detected sharing common business ownership, matching addresses, and closely fixed bid prices.
          </p>

          <div className="p-3 bg-[#FAECEB]/60 rounded border border-[#EFC2BF] flex items-center justify-between text-small">
            <span className="font-semibold text-risk-critical">Group Coordination Score:</span>
            <span className="font-mono font-bold text-risk-critical text-body">
              {(cluster.aggregateScore * 100).toFixed(0)}%
            </span>
          </div>

          {/* Fired Signal Checklist */}
          <div className="flex flex-col gap-2 pt-2 border-t border-line">
            <span className="text-micro font-semibold text-ink-700 uppercase tracking-wider">
              Matching Indicators ({cluster.signalsFired.length} of 6):
            </span>

            {cluster.signalsFired.map((sig) => (
              <div
                key={sig}
                className="flex items-center justify-between p-2 rounded bg-cream-50 border border-line text-micro font-medium"
              >
                <span className="text-ink-900">{signalLabels[sig] || sig}</span>
                <span className="px-1.5 py-0.2 rounded bg-risk-critical text-paper text-[10px] font-mono">
                  DETECTED
                </span>
              </div>
            ))}
          </div>

          {/* Connected Bidders List */}
          <div className="flex flex-col gap-2 pt-2 border-t border-line">
            <span className="text-micro font-semibold text-ink-700 uppercase tracking-wider">
              Connected Companies in Group ({cluster.bidderIds.length}):
            </span>

            {cluster.bidderIds.map((id) => {
              const b = bidderMap.get(id)
              return (
                <div
                  key={id}
                  onClick={() => onSelectBidder(id)}
                  className="p-2 rounded bg-paper border border-line hover:border-ink-300 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div>
                    <p className="text-small font-semibold text-ink-900 leading-tight">
                      {b ? displayName(b) : id}
                    </p>
                    <p className="text-micro text-ink-500 font-mono mt-0.5">
                      {piiRevealed ? (b?.pan || 'PAN Verified') : '●●●●●●●●●●'}
                    </p>
                  </div>
                  <RiskBadge level={b?.overallRisk || 'critical'} score={b?.riskScore} size="sm" />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
