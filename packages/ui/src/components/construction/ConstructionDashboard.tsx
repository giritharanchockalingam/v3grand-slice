'use client';
import { useState } from 'react';
import {
  useConstruction,
  useCreateBudgetLine, useUpdateBudgetLine, useDeleteBudgetLine,
  useCreateChangeOrder, useApproveChangeOrder, useDeleteChangeOrder,
  useCreateMilestone, useUpdateMilestone, useDeleteMilestone,
  useCreateRFI, useAnswerRFI, useDeleteRFI,
} from '../../hooks/use-construction';
import { usePermissions } from '../../hooks/use-permissions';

function fmt(v: number): string {
  if (Math.abs(v) >= 1_00_00_000) return (v / 1_00_00_000).toFixed(2) + ' Cr';
  if (Math.abs(v) >= 1_00_000) return (v / 1_00_000).toFixed(1) + ' L';
  return '₹' + v.toLocaleString('en-IN');
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  open: 'bg-blue-100 text-blue-800',
  answered: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-700',
  'not-started': 'bg-gray-100 text-gray-600',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  delayed: 'bg-red-100 text-red-800',
};

function SummaryCards({ summary }: { summary: any }) {
  const cards = [
    { label: 'Total Budget', value: fmt(summary.totalBudget), color: 'text-gray-800' },
    { label: 'Approved COs', value: fmt(summary.totalApprovedCOs), color: summary.totalApprovedCOs > 0 ? 'text-orange-600' : 'text-gray-800' },
    { label: 'Actual Spend', value: fmt(summary.totalActualSpend), color: 'text-blue-700' },
    { label: 'Commitments', value: fmt(summary.totalCommitments), color: 'text-purple-700' },
    { label: 'Budget Variance', value: fmt(summary.budgetVariance), color: summary.budgetVariance < 0 ? 'text-red-600' : 'text-green-600' },
    { label: 'Completion', value: `${summary.completionPct.toFixed(0)}%`, color: 'text-blue-700' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">{c.label}</div>
          <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-3">
      <div
        className={`h-3 rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-blue-500' : 'bg-yellow-500'}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

/* ── Budget Lines ── */
function BudgetLinesTable({ lines, dealId, canManage }: { lines: any[]; dealId: string; canManage: boolean }) {
  const createBL = useCreateBudgetLine(dealId);
  const deleteBL = useDeleteBudgetLine(dealId);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ costCode: '', description: '', category: 'hard-cost', originalAmount: '', currentBudget: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.costCode || !formData.description || !formData.originalAmount) return;
    const amt = parseFloat(formData.originalAmount);
    await createBL.mutateAsync({
      costCode: formData.costCode,
      description: formData.description,
      category: formData.category,
      originalAmount: amt,
      currentBudget: formData.currentBudget ? parseFloat(formData.currentBudget) : amt,
    });
    setFormData({ costCode: '', description: '', category: 'hard-cost', originalAmount: '', currentBudget: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="mb-4">
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              + Add Budget Line
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white border border-blue-200 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">New Budget Line</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cost Code</label>
                  <input type="text" value={formData.costCode} onChange={(e) => setFormData(f => ({ ...f, costCode: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" required placeholder="e.g. 03-100" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Category</label>
                  <select value={formData.category} onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm">
                    <option value="hard-cost">Hard Cost</option>
                    <option value="soft-cost">Soft Cost</option>
                    <option value="land">Land</option>
                    <option value="ff-e">FF&E</option>
                    <option value="contingency">Contingency</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" required placeholder="e.g. Concrete & Formwork" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Original Amount (₹)</label>
                  <input type="number" value={formData.originalAmount} onChange={(e) => setFormData(f => ({ ...f, originalAmount: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" required placeholder="e.g. 5000000" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Current Budget (₹, optional)</label>
                  <input type="number" value={formData.currentBudget} onChange={(e) => setFormData(f => ({ ...f, currentBudget: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" placeholder="Defaults to original" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={createBL.isPending}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {createBL.isPending ? 'Saving...' : 'Save Budget Line'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {!lines.length && <p className="text-sm text-gray-400">No budget lines.</p>}
      {lines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-left">
                <th className="px-3 py-2">Cost Code</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Original</th>
                <th className="px-3 py-2 text-right">COs</th>
                <th className="px-3 py-2 text-right">Current Budget</th>
                <th className="px-3 py-2 text-right">Actual</th>
                <th className="px-3 py-2 text-right">Committed</th>
                <th className="px-3 py-2 text-right">Variance</th>
                {canManage && <th className="px-3 py-2 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const currentBudget = typeof l.currentBudget === 'string' ? parseFloat(l.currentBudget) : l.currentBudget;
                const actualSpend = typeof l.actualSpend === 'string' ? parseFloat(l.actualSpend) : l.actualSpend;
                const commitments = typeof l.commitments === 'string' ? parseFloat(l.commitments) : l.commitments;
                const approvedCOs = typeof l.approvedCOs === 'string' ? parseFloat(l.approvedCOs) : l.approvedCOs;
                const originalAmount = typeof l.originalAmount === 'string' ? parseFloat(l.originalAmount) : l.originalAmount;
                const variance = currentBudget - actualSpend - commitments;
                const variancePct = currentBudget > 0 ? Math.abs(variance / currentBudget) : 0;
                const isOverBudget = variance < 0;
                const isCritical = isOverBudget && variancePct > 0.10;
                const isWarning = isOverBudget && variancePct > 0.05 && !isCritical;
                const rowBg = isCritical ? 'bg-red-50 hover:bg-red-100' : isWarning ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50';
                return (
                  <tr key={l.id} className={`border-b border-gray-100 ${rowBg}`}>
                    <td className="px-3 py-2 font-mono">{l.costCode}</td>
                    <td className="px-3 py-2">
                      {l.description}
                      {isCritical && <span className="ml-2 text-2xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">OVER &gt;10%</span>}
                      {isWarning && <span className="ml-2 text-2xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">WATCH</span>}
                    </td>
                    <td className="px-3 py-2">{l.category}</td>
                    <td className="px-3 py-2 text-right">{fmt(originalAmount)}</td>
                    <td className="px-3 py-2 text-right">{approvedCOs !== 0 ? fmt(approvedCOs) : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(currentBudget)}</td>
                    <td className="px-3 py-2 text-right">{fmt(actualSpend)}</td>
                    <td className="px-3 py-2 text-right">{fmt(commitments)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${isCritical ? 'text-red-700 font-bold' : isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                      {fmt(variance)}
                      {variancePct > 0 && <span className="text-2xs ml-1 text-gray-400">({(variancePct * 100).toFixed(1)}%)</span>}
                    </td>
                    {canManage && (
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => {
                            if (confirm(`Delete budget line "${l.costCode} — ${l.description}"?`)) {
                              deleteBL.mutate(l.id);
                            }
                          }}
                          className="px-2 py-0.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Change Orders ── */
function ChangeOrdersList({ orders, dealId, budgetLines, canManage }: { orders: any[]; dealId: string; budgetLines: any[]; canManage: boolean }) {
  const approve = useApproveChangeOrder(dealId);
  const create = useCreateChangeOrder(dealId);
  const deleteCO = useDeleteChangeOrder(dealId);
  const { canApprove, canCreateCO } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ budgetLineId: '', title: '', description: '', amount: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.budgetLineId || !formData.title || !formData.amount) return;
    const coNum = `CO-${String(orders.length + 1).padStart(3, '0')}`;
    await create.mutateAsync({
      budgetLineId: formData.budgetLineId,
      coNumber: coNum,
      title: formData.title,
      description: formData.description,
      amount: parseFloat(formData.amount),
    });
    setFormData({ budgetLineId: '', title: '', description: '', amount: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-3">
      {(canCreateCO || canManage) && (
        <div className="mb-4">
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              + New Change Order
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white border border-blue-200 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">New Change Order</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Budget Line</label>
                  <select value={formData.budgetLineId} onChange={(e) => setFormData(f => ({ ...f, budgetLineId: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" required>
                    <option value="">Select...</option>
                    {budgetLines.map((bl: any) => (
                      <option key={bl.id} value={bl.id}>{bl.costCode} — {bl.description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount (₹)</label>
                  <input type="number" value={formData.amount} onChange={(e) => setFormData(f => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" required placeholder="e.g. 500000" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Title</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" required placeholder="e.g. Additional MEP scope" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" rows={2} placeholder="Describe the change order..." />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={create.isPending}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {create.isPending ? 'Submitting...' : 'Submit CO'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {orders.length === 0 && <p className="text-sm text-gray-400">No change orders.</p>}
      {orders.map((co) => (
        <div key={co.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-500">{co.coNumber}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[co.status] ?? 'bg-gray-100'}`}>
                {co.status}
              </span>
            </div>
            <div className="text-sm font-medium">{co.title}</div>
            <div className="text-xs text-gray-500 mt-1">{co.description}</div>
            <div className="text-xs text-gray-400 mt-1">
              Amount: <span className={co.amount > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>{fmt(typeof co.amount === 'string' ? parseFloat(co.amount) : co.amount)}</span>
              {' · '}Requested by: {co.requestedBy}
              {co.approvedBy && <> · Approved by: {co.approvedBy}</>}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {(co.status === 'submitted' || co.status === 'draft') && canApprove && (
              <button onClick={() => approve.mutate(co.id)} disabled={approve.isPending}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                {approve.isPending ? 'Approving...' : 'Approve'}
              </button>
            )}
            {canManage && (
              <button
                onClick={() => { if (confirm(`Delete change order "${co.coNumber} — ${co.title}"?`)) deleteCO.mutate(co.id); }}
                className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Milestones ── */
function MilestonesTimeline({ milestones, dealId, canManage }: { milestones: any[]; dealId: string; canManage: boolean }) {
  const createMS = useCreateMilestone(dealId);
  const updateMS = useUpdateMilestone(dealId);
  const deleteMS = useDeleteMilestone(dealId);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', targetDate: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.targetDate) return;
    await createMS.mutateAsync(formData);
    setFormData({ name: '', description: '', targetDate: '' });
    setShowForm(false);
  };

  const cycleStatus = (ms: any) => {
    const statuses = ['not-started', 'in-progress', 'completed', 'delayed'];
    const currentIdx = statuses.indexOf(ms.status);
    const nextStatus = statuses[(currentIdx + 1) % statuses.length];
    updateMS.mutate({ id: ms.id, status: nextStatus, percentComplete: nextStatus === 'completed' ? 100 : ms.percentComplete });
  };

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="mb-4">
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              + Add Milestone
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white border border-blue-200 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">New Milestone</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" required placeholder="e.g. Foundation Complete" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target Date</label>
                  <input type="date" value={formData.targetDate} onChange={(e) => setFormData(f => ({ ...f, targetDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" rows={2} placeholder="Describe the milestone..." />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={createMS.isPending}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {createMS.isPending ? 'Saving...' : 'Save Milestone'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {!milestones.length && <p className="text-sm text-gray-400">No milestones.</p>}
      {milestones.map((ms) => (
        <div key={ms.id} className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex-shrink-0 mt-0.5">
            <div className={`w-3 h-3 rounded-full ${
              ms.status === 'completed' ? 'bg-green-500' :
              ms.status === 'in-progress' ? 'bg-blue-500' :
              ms.status === 'delayed' ? 'bg-red-500' : 'bg-gray-300'
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{ms.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[ms.status] ?? 'bg-gray-100'}`}>
                {ms.status}
              </span>
              <span className="text-xs text-gray-400">{ms.percentComplete}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{ms.description}</p>
            <div className="text-xs text-gray-400 mt-1">
              Target: {new Date(ms.targetDate).toLocaleDateString()}
              {ms.actualDate && <> · Actual: {new Date(ms.actualDate).toLocaleDateString()}</>}
            </div>
            <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${ms.status === 'delayed' ? 'bg-red-400' : 'bg-blue-400'}`}
                style={{ width: `${ms.percentComplete}%` }}
              />
            </div>
          </div>
          {canManage && (
            <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
              <button onClick={() => cycleStatus(ms)} title="Cycle status"
                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-blue-200">
                Status
              </button>
              <button onClick={() => { if (confirm(`Delete milestone "${ms.name}"?`)) deleteMS.mutate(ms.id); }}
                className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200">
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── RFIs ── */
function RFIsList({ rfis, dealId, canManage }: { rfis: any[]; dealId: string; canManage: boolean }) {
  const create = useCreateRFI(dealId);
  const answer = useAnswerRFI(dealId);
  const deleteRFI = useDeleteRFI(dealId);
  const { canCreateRFI } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ subject: '', question: '' });
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.question) return;
    const rfiNum = `RFI-${String(rfis.length + 1).padStart(3, '0')}`;
    await create.mutateAsync({ rfiNumber: rfiNum, ...formData });
    setFormData({ subject: '', question: '' });
    setShowForm(false);
  };

  const handleAnswer = async (rfiId: string) => {
    if (!answerText.trim()) return;
    await answer.mutateAsync({ id: rfiId, answer: answerText });
    setAnsweringId(null);
    setAnswerText('');
  };

  return (
    <div className="space-y-3">
      {(canCreateRFI || canManage) && (
        <div className="mb-4">
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              + New RFI
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white border border-blue-200 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">New RFI</h4>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Subject</label>
                <input type="text" value={formData.subject} onChange={(e) => setFormData(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" required placeholder="e.g. Structural reinforcement clarification" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Question</label>
                <textarea value={formData.question} onChange={(e) => setFormData(f => ({ ...f, question: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" rows={3} required placeholder="Describe your question..." />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={create.isPending}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {create.isPending ? 'Submitting...' : 'Submit RFI'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {rfis.length === 0 && <p className="text-sm text-gray-400">No RFIs.</p>}
      {rfis.map((rfi) => {
        const daysSinceCreated = rfi.createdAt ? Math.floor((Date.now() - new Date(rfi.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const isOverdue = rfi.status === 'open' && daysSinceCreated > 14;
        return (
          <div key={rfi.id} className={`bg-white border rounded-lg p-4 ${isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-500">{rfi.rfiNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[rfi.status] ?? 'bg-gray-100'}`}>
                    {rfi.status}
                  </span>
                  {isOverdue && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                      OVERDUE ({daysSinceCreated}d)
                    </span>
                  )}
                  {rfi.status === 'open' && daysSinceCreated > 7 && !isOverdue && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      {daysSinceCreated}d open
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium">{rfi.subject}</div>
                <div className="text-xs text-gray-600 mt-1">Q: {rfi.question}</div>
                {rfi.answer && <div className="text-xs text-green-700 mt-1">A: {rfi.answer}</div>}
                <div className="text-xs text-gray-400 mt-1">Raised by: {rfi.raisedBy}</div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
                  {rfi.status === 'open' && !rfi.answer && (
                    <button onClick={() => { setAnsweringId(rfi.id); setAnswerText(''); }} title="Answer RFI"
                      className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded border border-green-200">
                      Answer
                    </button>
                  )}
                  <button onClick={() => { if (confirm(`Delete RFI "${rfi.rfiNumber} — ${rfi.subject}"?`)) deleteRFI.mutate(rfi.id); }}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200">
                    Delete
                  </button>
                </div>
              )}
            </div>

            {/* Inline Answer Form */}
            {answeringId === rfi.id && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <label className="block text-xs text-gray-500 mb-1">Your Answer</label>
                <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" rows={2} placeholder="Type your answer..." autoFocus />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleAnswer(rfi.id)} disabled={answer.isPending || !answerText.trim()}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                    {answer.isPending ? 'Saving...' : 'Submit Answer'}
                  </button>
                  <button onClick={() => setAnsweringId(null)}
                    className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Dashboard ── */
export function ConstructionDashboard({ dealId }: { dealId: string }) {
  const { data, isLoading, error } = useConstruction(dealId);
  const { canManageConstruction, canEdit } = usePermissions();
  const [activeSection, setActiveSection] = useState<'budget' | 'cos' | 'milestones' | 'rfis'>('budget');

  const canManage = canManageConstruction || canEdit;

  if (isLoading) return <div className="p-8 text-gray-400">Loading construction data...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {(error as Error).message}</div>;
  if (!data) return <div className="p-8 text-gray-400">No construction data available.</div>;

  const { summary, budgetLines, changeOrders, milestones, rfis } = data;

  const sections = [
    { key: 'budget' as const, label: 'Budget Lines', count: budgetLines.length },
    { key: 'cos' as const, label: 'Change Orders', count: changeOrders.length },
    { key: 'milestones' as const, label: 'Milestones', count: milestones.length },
    { key: 'rfis' as const, label: 'RFIs', count: rfis.length },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Construction Tracking</h2>

      {/* Summary Cards */}
      <SummaryCards summary={summary} />

      {/* Overall Progress */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">Overall Construction Progress</span>
          <span className="text-sm font-medium text-gray-800">{summary.completionPct.toFixed(0)}%</span>
        </div>
        <ProgressBar pct={summary.completionPct} />
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeSection === s.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.label} <span className="text-xs text-gray-400">({s.count})</span>
          </button>
        ))}
      </div>

      {/* Section Content */}
      <div>
        {activeSection === 'budget' && <BudgetLinesTable lines={budgetLines} dealId={dealId} canManage={canManage} />}
        {activeSection === 'cos' && <ChangeOrdersList orders={changeOrders} dealId={dealId} budgetLines={budgetLines} canManage={canManage} />}
        {activeSection === 'milestones' && <MilestonesTimeline milestones={milestones} dealId={dealId} canManage={canManage} />}
        {activeSection === 'rfis' && <RFIsList rfis={rfis} dealId={dealId} canManage={canManage} />}
      </div>
    </div>
  );
}
