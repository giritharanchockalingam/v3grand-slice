'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api-client'
import { useAuth } from '../../lib/auth-context'

// Types
interface Deal {
  id: string
  name: string
  phase: 'ORIGINATION' | 'DUE_DILIGENCE' | 'UNDER_CONTRACT' | 'OPERATING' | 'EXIT'
  aum?: number
  investedAmount?: number
}

interface DealMetrics {
  id: string
  name: string
  phase: string
  month: number
  irr: number
  npv: number
  equityMultiple: number
  dscr: number
  verdict: 'INVEST' | 'HOLD' | 'DE-RISK' | 'EXIT'
  confidence: number
}

interface PortfolioData {
  totalAUM: number
  weightedAvgIRR: number
  activeDealCount: number
  totalDealCount: number
  healthScore: number
  deals: DealMetrics[]
}

// Mock data for portfolio
const mockPortfolioData: PortfolioData = {
  totalAUM: 245000000,
  weightedAvgIRR: 14.2,
  activeDealCount: 18,
  totalDealCount: 22,
  healthScore: 82,
  deals: [
    {
      id: '1',
      name: 'Waterfront Plaza',
      phase: 'OPERATING',
      month: 24,
      irr: 18.5,
      npv: 12500000,
      equityMultiple: 2.1,
      dscr: 1.42,
      verdict: 'INVEST',
      confidence: 92,
    },
    {
      id: '2',
      name: 'Tech Hub Downtown',
      phase: 'OPERATING',
      month: 18,
      irr: 16.3,
      npv: 8200000,
      equityMultiple: 1.85,
      dscr: 1.38,
      verdict: 'INVEST',
      confidence: 88,
    },
    {
      id: '3',
      name: 'Residential Tower',
      phase: 'DUE_DILIGENCE',
      month: 3,
      irr: 12.1,
      npv: 5600000,
      equityMultiple: 1.62,
      dscr: 1.28,
      verdict: 'HOLD',
      confidence: 75,
    },
    {
      id: '4',
      name: 'Mixed-Use Complex',
      phase: 'OPERATING',
      month: 12,
      irr: 14.8,
      npv: 7100000,
      equityMultiple: 1.75,
      dscr: 1.35,
      verdict: 'HOLD',
      confidence: 80,
    },
    {
      id: '5',
      name: 'Retail Strip',
      phase: 'OPERATING',
      month: 30,
      irr: 8.5,
      npv: 2200000,
      equityMultiple: 1.35,
      dscr: 1.15,
      verdict: 'DE-RISK',
      confidence: 65,
    },
    {
      id: '6',
      name: 'Office Building A',
      phase: 'UNDER_CONTRACT',
      month: 6,
      irr: 11.2,
      npv: 4300000,
      equityMultiple: 1.50,
      dscr: 1.22,
      verdict: 'HOLD',
      confidence: 72,
    },
    {
      id: '7',
      name: 'Industrial Park',
      phase: 'OPERATING',
      month: 36,
      irr: 5.8,
      npv: -800000,
      equityMultiple: 0.95,
      dscr: 1.08,
      verdict: 'EXIT',
      confidence: 58,
    },
    {
      id: '8',
      name: 'Student Housing',
      phase: 'DUE_DILIGENCE',
      month: 2,
      irr: 15.6,
      npv: 6800000,
      equityMultiple: 1.92,
      dscr: 1.40,
      verdict: 'INVEST',
      confidence: 85,
    },
  ],
}

// Component: Summary Card
function SummaryCard({
  title,
  value,
  subtitle,
  variant = 'default',
}: {
  title: string
  value: string | number
  subtitle?: string
  variant?: 'default' | 'success' | 'warning'
}) {
  const bgColor = {
    default: 'bg-white',
    success: 'bg-teal-50',
    warning: 'bg-amber-50',
  }[variant]

  const textColor = {
    default: 'text-gray-700',
    success: 'text-teal-700',
    warning: 'text-amber-700',
  }[variant]

  return (
    <div className={`${bgColor} rounded-lg shadow p-6 border border-gray-200`}>
      <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
      <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
    </div>
  )
}

// Component: Verdict Badge
function VerdictBadge({ verdict, confidence }: { verdict: string; confidence: number }) {
  const styles = {
    INVEST: 'bg-green-100 text-green-800 border-green-300',
    HOLD: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'DE-RISK': 'bg-orange-100 text-orange-800 border-orange-300',
    EXIT: 'bg-red-100 text-red-800 border-red-300',
  }

  const badgeStyle = styles[verdict as keyof typeof styles] || styles.HOLD

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-block px-3 py-1 rounded text-xs font-semibold border ${badgeStyle}`}>
        {verdict}
      </span>
      <span className="text-xs text-gray-500">{confidence}% conf.</span>
    </div>
  )
}

// Component: Deal Comparison Table
function DealComparisonTable({
  deals,
  onRowClick,
}: {
  deals: DealMetrics[]
  onRowClick: (dealId: string) => void
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{
    key: keyof DealMetrics
    direction: 'asc' | 'desc'
  }>({ key: 'name', direction: 'asc' })

  const filteredDeals = deals.filter((deal) =>
    deal.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const sortedDeals = useMemo(() => {
    const sorted = [...filteredDeals].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string)
      }

      const numA = Number(aVal) || 0
      const numB = Number(bVal) || 0
      return sortConfig.direction === 'asc' ? numA - numB : numB - numA
    })
    return sorted
  }, [filteredDeals, sortConfig])

  const handleSort = (key: keyof DealMetrics) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const SortIcon = ({ column }: { column: keyof DealMetrics }) => {
    if (sortConfig.key !== column) return <span className="text-gray-300">↕</span>
    return <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by deal name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}>
                Name <SortIcon column="name" />
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('phase')}>
                Phase <SortIcon column="phase" />
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('month')}>
                Month <SortIcon column="month" />
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('irr')}>
                IRR <SortIcon column="irr" />
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('npv')}>
                NPV <SortIcon column="npv" />
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('equityMultiple')}>
                Equity Multiple <SortIcon column="equityMultiple" />
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('dscr')}>
                DSCR <SortIcon column="dscr" />
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {sortedDeals.map((deal) => (
              <tr
                key={deal.id}
                onClick={() => onRowClick(deal.id)}
                className="border-b border-gray-200 hover:bg-teal-50 cursor-pointer transition-colors"
              >
                <td className="py-4 px-4 font-medium text-gray-900">{deal.name}</td>
                <td className="py-4 px-4 text-gray-600">
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {deal.phase.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-4 px-4 text-center text-gray-600">{deal.month}mo</td>
                <td className="py-4 px-4 text-center font-semibold text-teal-700">{deal.irr.toFixed(1)}%</td>
                <td className="py-4 px-4 text-center text-gray-600">
                  ${(deal.npv / 1000000).toFixed(1)}M
                </td>
                <td className="py-4 px-4 text-center text-gray-600">{deal.equityMultiple.toFixed(2)}x</td>
                <td className="py-4 px-4 text-center text-gray-600">{deal.dscr.toFixed(2)}x</td>
                <td className="py-4 px-4 text-center">
                  <VerdictBadge verdict={deal.verdict} confidence={deal.confidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedDeals.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No deals found matching your search.
        </div>
      )}
    </div>
  )
}

// Component: Risk Heat Map
function RiskHeatMap({ deals }: { deals: DealMetrics[] }) {
  const phases = ['ORIGINATION', 'DUE_DILIGENCE', 'UNDER_CONTRACT', 'OPERATING', 'EXIT']
  const verdicts = ['INVEST', 'HOLD', 'DE-RISK', 'EXIT']

  const heatMapData = phases.map((phase) =>
    verdicts.map((verdict) => {
      const count = deals.filter((d) => d.phase === phase && d.verdict === verdict).length
      return count
    })
  )

  const getHeatColor = (value: number, max: number) => {
    if (value === 0) return 'bg-gray-50'
    const intensity = value / max
    if (intensity > 0.66) return 'bg-red-500 text-white'
    if (intensity > 0.33) return 'bg-orange-400 text-white'
    return 'bg-yellow-300 text-gray-900'
  }

  const maxCount = Math.max(...heatMapData.flat())

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Portfolio Risk Heat Map</h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Verdict / Phase</th>
              {phases.map((phase) => (
                <th
                  key={phase}
                  className="text-center py-2 px-4 text-xs font-semibold text-gray-700 w-28"
                >
                  {phase.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {verdicts.map((verdict) => (
              <tr key={verdict}>
                <td className="py-3 px-4 text-sm font-medium text-gray-700">{verdict}</td>
                {heatMapData.map((row, phaseIdx) => {
                  const count = row[verdicts.indexOf(verdict)]
                  return (
                    <td
                      key={`${verdict}-${phaseIdx}`}
                      className={`py-3 px-4 text-center w-28 rounded font-semibold ${getHeatColor(
                        count,
                        maxCount
                      )}`}
                    >
                      {count}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Component: Verdict Distribution Chart
function VerdictDistributionChart({ deals }: { deals: DealMetrics[] }) {
  const verdicts = ['INVEST', 'HOLD', 'DE-RISK', 'EXIT'] as const
  const verdictCounts = verdicts.map((v) => ({
    verdict: v,
    count: deals.filter((d) => d.verdict === v).length,
  }))

  const maxCount = Math.max(...verdictCounts.map((v) => v.count), 1)

  const verdictColors = {
    INVEST: 'bg-green-500',
    HOLD: 'bg-yellow-500',
    'DE-RISK': 'bg-orange-500',
    EXIT: 'bg-red-500',
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Verdict Distribution</h3>

      <div className="space-y-6">
        {verdictCounts.map(({ verdict, count }) => {
          const percentage = (count / maxCount) * 100
          return (
            <div key={verdict}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{verdict}</span>
                <span className="text-sm font-bold text-gray-900">{count} deals</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                <div
                  className={`h-full ${verdictColors[verdict as keyof typeof verdictColors]} rounded-full flex items-center justify-end pr-3 transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                >
                  {percentage > 15 && <span className="text-xs font-bold text-white">{percentage.toFixed(0)}%</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Component: IRR Distribution Histogram
function IRRDistributionChart({ deals }: { deals: DealMetrics[] }) {
  const ranges = [
    { label: '<5%', min: -Infinity, max: 5 },
    { label: '5-10%', min: 5, max: 10 },
    { label: '10-15%', min: 10, max: 15 },
    { label: '15-20%', min: 15, max: 20 },
    { label: '20%+', min: 20, max: Infinity },
  ]

  const irrCounts = ranges.map((range) => ({
    label: range.label,
    count: deals.filter((d) => d.irr >= range.min && d.irr < range.max).length,
  }))

  const maxCount = Math.max(...irrCounts.map((c) => c.count), 1)

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">IRR Distribution</h3>

      <div className="space-y-6">
        {irrCounts.map(({ label, count }) => {
          const percentage = (count / maxCount) * 100
          return (
            <div key={label}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <span className="text-sm font-bold text-gray-900">{count} deals</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full flex items-center justify-end pr-3 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                >
                  {percentage > 15 && <span className="text-xs font-bold text-white">{percentage.toFixed(0)}%</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Main Page Component
export default function PortfolioPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  // In production, fetch from API. For now, use mock data.
  const { data: portfolioData, isLoading, error } = useQuery<PortfolioData>({
    queryKey: ['portfolio'],
    queryFn: async () => {
      // Uncomment to use real API:
      // const response = await api.get('/deals')
      // const deals = response.data
      // ... fetch metrics for each deal and aggregate
      // For now, return mock data:
      return mockPortfolioData
    },
    enabled: !!user,
  })

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading portfolio data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <p className="text-red-600 font-semibold mb-2">Error Loading Portfolio</p>
          <p className="text-gray-600 mb-6">
            Unable to load portfolio data. Please refresh the page or try again later.
          </p>
          <button
            onClick={() => router.refresh()}
            className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  if (!portfolioData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 font-medium">No portfolio data available</p>
        </div>
      </div>
    )
  }

  const handleDealClick = (dealId: string) => {
    router.push(`/deals/${dealId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Portfolio Analytics</h1>
              <p className="text-gray-600 text-sm mt-1">Multi-deal comparison and performance metrics</p>
            </div>
            <Link
              href="/deals"
              className="text-teal-600 hover:text-teal-700 font-medium flex items-center gap-2"
            >
              ← Back to Deals
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <SummaryCard
            title="Total AUM"
            value={`$${(portfolioData.totalAUM / 1000000).toFixed(0)}M`}
            subtitle="Assets Under Management"
            variant="default"
          />
          <SummaryCard
            title="Weighted Average IRR"
            value={`${portfolioData.weightedAvgIRR.toFixed(1)}%`}
            subtitle="Portfolio-wide return"
            variant="success"
          />
          <SummaryCard
            title="Active Deals"
            value={`${portfolioData.activeDealCount}/${portfolioData.totalDealCount}`}
            subtitle="Active vs total deals"
            variant="default"
          />
          <SummaryCard
            title="Portfolio Health"
            value={`${portfolioData.healthScore}%`}
            subtitle="Deals with INVEST/HOLD"
            variant={portfolioData.healthScore >= 75 ? 'success' : 'warning'}
          />
        </div>

        {/* Deal Comparison Table */}
        <div className="mb-8">
          <DealComparisonTable deals={portfolioData.deals} onRowClick={handleDealClick} />
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Risk Heat Map - spans 2 columns on desktop */}
          <div className="lg:col-span-2">
            <RiskHeatMap deals={portfolioData.deals} />
          </div>

          {/* Verdict Distribution */}
          <div>
            <VerdictDistributionChart deals={portfolioData.deals} />
          </div>
        </div>

        {/* IRR Distribution */}
        <div className="mb-8">
          <IRRDistributionChart deals={portfolioData.deals} />
        </div>

        {/* Footer Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-600">
          <p>
            Portfolio data last updated: <span className="font-semibold">{new Date().toLocaleDateString()}</span>
          </p>
          <p className="mt-2">
            For detailed analysis of any deal, click on a row in the Deal Comparison Table above.
          </p>
        </div>
      </div>
    </div>
  )
}
