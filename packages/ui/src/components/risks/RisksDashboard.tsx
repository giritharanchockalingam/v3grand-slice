// ─── Risk Register Dashboard ────────────────────────────────────────
'use client';

import { useState } from 'react';
import { useRisks, useCreateRisk, useUpdateRisk, type Risk } from '../../hooks/use-risks';
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

function RiskRow({
  risk,
  onStatusChange,
}: {
  risk: Risk;
  onStatusChange: (riskId: string, status: string) => void;
}) {
  return (
    <div className={`rounded-lg border p-4 ${STATUS_COLORS[risk.status] ?? STATUS_COLORS.open}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-medium text-sm">{risk.title}</h4>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600 mr-1">{risk.category}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded ${IMPACT_COLORS[risk.likelihood] ?? ''}`}>
            L: {risk.likelihood}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${IMPACT_COLORS[risk.impact] ?? ''}`}>
            I: {risk.impact}
          </span>
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

export function RisksDashboard({ dealId }: { dealId: string }) {
  const { data, isLoading, error } = useRisks(dealId);
  const createRisk = useCreateRisk(dealId);
  const updateRisk = useUpdateRisk(dealId);
  const { canEdit } = usePermissions();
  const [showForm, setShowForm] = useState(false);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description) return;
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

      {/* Header + Add Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Risk Register</h2>
        {canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
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
              {createRisk.isPending ? 'Saving...' : 'Save Risk'}
            </button>
          </div>
        </form>
      )}

      {/* Risk List */}
      {risks.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-8">
          No risks registered yet. Click "+ Add Risk" to log the first one.
        </div>
      ) : (
        <div className="space-y-3">
          {risks.map((risk) => (
            <RiskRow
              key={risk.id}
              risk={risk}
              onStatusChange={(riskId, status) => updateRisk.mutate({ riskId, status })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
