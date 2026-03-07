// ─── Risk Register Dashboard ────────────────────────────────────────
'use client';

import { useState } from 'react';
import { useRisks, useCreateRisk, useUpdateRisk, useDeleteRisk, type Risk } from '../../hooks/use-risks';
import { usePermissions } from '../../hooks/use-permissions';

const CATEGORIES = ['market', 'construction', 'financial', 'regulatory', 'operational'] as const;
const LEVELS = ['low', 'medium', 'high'] as const;

const IMPACT_COLORS: Record<string, string> = {
  high:   'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low:    'bg-green-100 text-green-800',
};

const STATUS_COLORS: Record<string, string> = {
  open:      'bg-red-50 text-red-700 border-red-200',
  mitigated: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  closed:    'bg-gray-50 text-gray-500 border-gray-200',
};

// Risk Matrix severity mapping
const getRiskSeverity = (likelihood: string, impact: string): 'critical' | 'high' | 'medium' | 'low' => {
  const score = (LEVELS.indexOf(likelihood as any) + 1) * (LEVELS.indexOf(impact as any) + 1);
  if (score >= 9) return 'critical';
  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-400 text-white',
  low: 'bg-green-500 text-white',
};

function RiskRow({
  risk,
  onStatusChange,
  onEdit,
  onDelete,
  canEdit,
}: {
  risk: Risk;
  onStatusChange: (riskId: string, status: string) => void;
  onEdit: (risk: Risk) => void;
  onDelete: (riskId: string) => void;
  canEdit: boolean;
}) {
  const severity = getRiskSeverity(risk.likelihood, risk.impact);
  const severityColor = SEVERITY_COLORS[severity];

  return (
    <div className={`rounded-lg border p-4 ${STATUS_COLORS[risk.status] ?? STATUS_COLORS.open}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{risk.title}</h4>
            <span className={`text-xs px-2 py-0.5 rounded font-bold ${severityColor}`}>
              {severity.toUpperCase()}
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600 mr-1">{risk.category}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded ${IMPACT_COLORS[risk.likelihood] ?? ''}`}>
            L: {risk.likelihood}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${IMPACT_COLORS[risk.impact] ?? ''}`}>
            I: {risk.impact}
          </span>
          {canEdit && (
            <>
              <button
                onClick={() => onEdit(risk)}
                className="px-2 py-0.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 text-xs"
                title="Edit risk"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete risk "${risk.title}"?`)) onDelete(risk.id);
                }}
                className="px-2 py-0.5 rounded border border-red-300 bg-white text-red-600 hover:bg-red-50 text-xs"
                title="Delete risk"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-600 mb-2">{risk.description}</p>
      {risk.mitigation && (
        <p className="text-xs text-blue-600 mb-2"><strong>Mitigation:</strong> {risk.mitigation}</p>
      )}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">
          {risk.owner ? `Owner: ${risk.owner}` : 'No owner'} · {new Date(risk.createdAt).toLocaleDateString()}
        </span>
        {risk.status === 'open' && (
          <div className="flex gap-1">
            <button
              onClick={() => onStatusChange(risk.id, 'mitigated')}
              className="px-2 py-0.5 rounded border border-blue-300 bg-white text-blue-600 hover:bg-blue-50"
            >
              Mitigate
            </button>
            <button
              onClick={() => onStatusChange(risk.id, 'accepted')}
              className="px-2 py-0.5 rounded border border-yellow-300 bg-white text-yellow-600 hover:bg-yellow-50"
            >
              Accept
            </button>
            <button
              onClick={() => onStatusChange(risk.id, 'closed')}
              className="px-2 py-0.5 rounded border border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RiskMatrix({ risks }: { risks: Risk[] }) {
  if (risks.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 p-4 bg-white">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Risk Matrix (Probability vs Impact)</h3>
      <div className="grid grid-cols-4 gap-1">
        {/* Header Row */}
        <div />
        {['Low', 'Medium', 'High'].map(label => (
          <div key={label} className="text-xs font-medium text-center text-gray-600 py-2">
            {label}
          </div>
        ))}

        {/* Risk Matrix Cells */}
        {LEVELS.map(likelihood => (
          <div key={likelihood}>
            <div className="text-xs font-medium text-gray-600 py-2 text-right pr-2 capitalize">
              {likelihood}
            </div>
            {LEVELS.map(impact => {
              const cellRisks = risks.filter(r => r.likelihood === likelihood && r.impact === impact);
              const severity = getRiskSeverity(likelihood, impact);
              const bgColor = severity === 'critical'
                ? 'bg-red-100'
                : severity === 'high'
                ? 'bg-orange-100'
                : severity === 'medium'
                ? 'bg-yellow-100'
                : 'bg-green-100';

              return (
                <div
                  key={`${likelihood}-${impact}`}
                  className={`rounded border border-gray-300 ${bgColor} min-h-24 p-1 flex flex-col items-center justify-center`}
                >
                  {cellRisks.length > 0 && (
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-700">{cellRisks.length}</div>
                      <div className="text-xs text-gray-600">risk{cellRisks.length !== 1 ? 's' : ''}</div>
                      <div className="mt-1 flex flex-wrap gap-0.5 justify-center">
                        {cellRisks.slice(0, 3).map(r => (
                          <span
                            key={r.id}
                            className="text-xs bg-white text-gray-700 px-1 py-0.5 rounded truncate max-w-full"
                            title={r.title}
                          >
                            {r.title.substring(0, 10)}...
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Each cell shows the number of risks at that probability/impact level. Green is low risk; red is critical.
      </p>
    </div>
  );
}

export function RisksDashboard({ dealId }: { dealId: string }) {
  const { data, isLoading, error } = useRisks(dealId);
  const createRisk = useCreateRisk(dealId);
  const updateRisk = useUpdateRisk(dealId);
  const deleteRisk = useDeleteRisk(dealId);
  const { canEdit } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'matrix' | 'list'>('overview');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'market' as string,
    likelihood: 'medium' as string,
    impact: 'medium' as string,
    mitigation: '',
    owner: '',
  });

  if (isLoading) return <div className="p-8 text-gray-400">Loading risks...</div>;
  if (error) return <div className="p-8 text-red-500">Error loading risks: {(error as Error).message}</div>;

  const { risks = [], summary } = data ?? {};

  // Apply filters
  let filteredRisks = risks;
  if (filterCategory !== 'all') {
    filteredRisks = filteredRisks.filter(r => r.category === filterCategory);
  }
  if (filterStatus !== 'all') {
    filteredRisks = filteredRisks.filter(r => r.status === filterStatus);
  }

  function handleEdit(risk: Risk) {
    setEditingRisk(risk);
    setForm({
      title: risk.title,
      description: risk.description,
      category: risk.category,
      likelihood: risk.likelihood,
      impact: risk.impact,
      mitigation: risk.mitigation ?? '',
      owner: risk.owner ?? '',
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description) return;

    if (editingRisk) {
      // Update existing risk
      updateRisk.mutate({
        riskId: editingRisk.id,
        ...form,
        mitigation: form.mitigation || undefined,
        owner: form.owner || undefined,
      }, {
        onSuccess: () => {
          setShowForm(false);
          setEditingRisk(null);
          setForm({ title: '', description: '', category: 'market', likelihood: 'medium', impact: 'medium', mitigation: '', owner: '' });
        },
      });
    } else {
      // Create new risk
      createRisk.mutate({
        ...form,
        mitigation: form.mitigation || undefined,
        owner: form.owner || undefined,
      }, {
        onSuccess: () => {
          setShowForm(false);
          setForm({ title: '', description: '', category: 'market', likelihood: 'medium', impact: 'medium', mitigation: '', owner: '' });
        },
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="flex gap-4 overflow-x-auto">
        <div className="rounded-lg border border-gray-200 p-3 min-w-[120px]">
          <p className="text-xs text-gray-500">Total Risks</p>
          <p className="text-2xl font-bold text-gray-900">{summary?.total ?? 0}</p>
        </div>
        <div className="rounded-lg border border-red-200 p-3 min-w-[120px]">
          <p className="text-xs text-gray-500">Open</p>
          <p className="text-2xl font-bold text-red-700">{summary?.open ?? 0}</p>
        </div>
        <div className="rounded-lg border border-orange-200 p-3 min-w-[120px]">
          <p className="text-xs text-gray-500">High Priority</p>
          <p className="text-2xl font-bold text-orange-700">{summary?.highPriority ?? 0}</p>
        </div>
      </div>

      {/* Header + Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'matrix'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Risk Matrix
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Risk List
          </button>
        </div>

        {canEdit && (
          <button
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                setEditingRisk(null);
                setForm({ title: '', description: '', category: 'market', likelihood: 'medium', impact: 'medium', mitigation: '', owner: '' });
              } else {
                setShowForm(true);
              }
            }}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            {showForm ? 'Cancel' : '+ Add Risk'}
          </button>
        )}
      </div>

      {/* Add Risk Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
          <input
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            placeholder="Risk title"
            value={form.title}
            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            placeholder="Description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            required
          />
          <div className="grid grid-cols-3 gap-3">
            <select
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              value={form.category}
              onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              value={form.likelihood}
              onChange={(e) => setForm(f => ({ ...f, likelihood: e.target.value }))}
            >
              {LEVELS.map(l => <option key={l} value={l}>Likelihood: {l}</option>)}
            </select>
            <select
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              value={form.impact}
              onChange={(e) => setForm(f => ({ ...f, impact: e.target.value }))}
            >
              {LEVELS.map(l => <option key={l} value={l}>Impact: {l}</option>)}
            </select>
          </div>
          <input
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            placeholder="Mitigation strategy (optional)"
            value={form.mitigation}
            onChange={(e) => setForm(f => ({ ...f, mitigation: e.target.value }))}
          />
          <div className="flex gap-3 items-center">
            <input
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="Owner (optional)"
              value={form.owner}
              onChange={(e) => setForm(f => ({ ...f, owner: e.target.value }))}
            />
            <button
              type="submit"
              disabled={createRisk.isPending}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg"
            >
              {(createRisk.isPending || updateRisk.isPending) ? 'Saving...' : editingRisk ? 'Update Risk' : 'Save Risk'}
            </button>
          </div>
        </form>
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Filters */}
          <div className="flex gap-3 overflow-x-auto">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="mitigated">Mitigated</option>
                <option value="accepted">Accepted</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Risk List */}
          {filteredRisks.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-8">
              {risks.length === 0
                ? 'No risks registered yet. Click "+ Add Risk" to log the first one.'
                : 'No risks match the current filters.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRisks.map((risk) => (
                <RiskRow
                  key={risk.id}
                  risk={risk}
                  canEdit={canEdit}
                  onStatusChange={(riskId, status) => updateRisk.mutate({ riskId, status })}
                  onEdit={handleEdit}
                  onDelete={(riskId) => deleteRisk.mutate(riskId)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'matrix' && (
        <>
          {risks.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-8">
              No risks to display. Add risks to see the matrix.
            </div>
          ) : (
            <RiskMatrix risks={risks} />
          )}
        </>
      )}

      {activeTab === 'list' && (
        <>
          {/* Compact List View */}
          {risks.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-8">
              No risks registered yet.
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-left border-b border-gray-200">
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Likelihood</th>
                    <th className="px-3 py-2">Impact</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Owner</th>
                    <th className="px-3 py-2">Created</th>
                    {canEdit && <th className="px-3 py-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {risks.map((risk) => {
                    const severity = getRiskSeverity(risk.likelihood, risk.impact);
                    return (
                      <tr key={risk.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{risk.title}</td>
                        <td className="px-3 py-2">{risk.category}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${IMPACT_COLORS[risk.likelihood]}`}>
                            {risk.likelihood}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs ${IMPACT_COLORS[risk.impact]}`}>
                            {risk.impact}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${SEVERITY_COLORS[severity]}`}>
                            {severity}
                          </span>
                        </td>
                        <td className="px-3 py-2">{risk.owner ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {new Date(risk.createdAt).toLocaleDateString()}
                        </td>
                        {canEdit && (
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleEdit(risk)}
                                className="px-2 py-0.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete risk "${risk.title}"?`)) deleteRisk.mutate(risk.id);
                                }}
                                className="px-2 py-0.5 rounded border border-red-300 bg-white text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
