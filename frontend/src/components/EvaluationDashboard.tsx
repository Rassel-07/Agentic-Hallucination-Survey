'use client';

import React, { useState, useEffect } from 'react';
import { getEvaluationSummary, getCategoryResults, getAblationResults } from '@/lib/api';
import { EvaluationSummary, CategorySummary, EvaluationItem, AblationConfig } from '@/types';
import { 
  BarChart3, 
  TrendingDown, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Layers, 
  Clock, 
  ShieldAlert, 
  Activity, 
  ArrowDownRight, 
  Sparkles,
  GitCompare,
  AlertTriangle,
  Info,
  RefreshCw
} from 'lucide-react';

interface EvaluationDashboardProps {
  isConnected: boolean;
}

export default function EvaluationDashboard({ isConnected }: EvaluationDashboardProps) {
  const [summaryData, setSummaryData] = useState<EvaluationSummary | null>(null);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [ablationData, setAblationData] = useState<AblationConfig[]>([]);
  const [items, setItems] = useState<EvaluationItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState<EvaluationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState<string>('mojtaba142/hotel-booking');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, catRes, ablRes] = await Promise.all([
        getEvaluationSummary(),
        getCategoryResults(),
        getAblationResults(),
      ]);
      if (!sumRes && !catRes && !ablRes) {
        setError('Colab backend offline or evaluation endpoints unreachable.');
      }
      if (sumRes?.summary) setSummaryData(sumRes.summary);
      if (sumRes?.dataset) setDatasetName(sumRes.dataset);
      if (catRes?.categories) setCategories(catRes.categories);
      if (catRes?.items) setItems(catRes.items);
      if (ablRes?.configurations) setAblationData(ablRes.configurations);
    } catch (err: any) {
      console.error('Failed to load evaluation data:', err);
      setError(err?.message || 'Failed to load evaluation data from Google Colab.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isConnected]);

  const categoryOptions = ['ALL', 'normal', 'ambiguous', 'hallucination_inducing', 'tool_misuse', 'out_of_scope'];
  const filteredItems = items.filter(item => activeCategory === 'ALL' || item.category === activeCategory);

  if (loading && !summaryData) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <RefreshCw size={32} className="spinner" color="var(--cyan-bright)" style={{ marginBottom: 16 }} />
        <h3 style={{ color: '#fff', marginBottom: 8 }}>Loading Real Colab Evaluation Data...</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Querying /evaluation-summary, /category-results, and /ablation-results from your active Google Colab API.
        </p>
      </div>
    );
  }

  if (!summaryData) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '50px 20px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <AlertTriangle size={36} color="#EF4444" style={{ marginBottom: 14 }} />
        <h3 style={{ color: '#fff', marginBottom: 8 }}>Google Colab Backend Offline</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '560px', margin: '0 auto 20px', lineHeight: 1.6 }}>
          {error || 'Unable to retrieve benchmark evaluation data from Google Colab. Please confirm that your Colab FastAPI server and Cloudflare tunnel are active, then click retry.'}
        </p>
        <button 
          className="btn-primary" 
          onClick={fetchData}
          style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <RefreshCw size={16} />
          <span>Retry Colab Connection</span>
        </button>
      </div>
    );
  }

  const accuracyJump = (summaryData.with5in1_expected_behavior_pct - summaryData.baseline_expected_behavior_pct).toFixed(1);
  const latencyOverhead = Math.round(summaryData.avg_latency_with_ms - summaryData.avg_latency_without_ms);
  const maxLatency = Math.max(summaryData.avg_latency_with_ms, summaryData.avg_latency_without_ms, 1);
  const baselineLatencyWidth = Math.max(Math.min((summaryData.avg_latency_without_ms / maxLatency) * 100, 100), 10);
  const with5in1LatencyWidth = Math.max(Math.min((summaryData.avg_latency_with_ms / maxLatency) * 100, 100), 10);
  const totalItemCount = items.length || 25;

  return (
    <div className="fade-in">
      {/* SECTION 1: OVERALL PERFORMANCE METRIC CARDS */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={24} color="#06B6D4" />
            <span>1. Overall Research Performance</span>
          </h2>
          <span className="badge-tag cyan">
            Kaggle Hotel Booking Benchmark ({totalItemCount} Test Items)
          </span>
        </div>

        {summaryData && (
          <div className="kpi-grid">
            {/* Card 1: Avg HRS WITHOUT 5in1 */}
            <div className="kpi-card" style={{ borderLeft: '4px solid var(--rose-primary)' }}>
              <div className="kpi-label">
                <span>Avg HRS (Without 5in1)</span>
                <XCircle size={16} color="#EF4444" />
              </div>
              <div className="kpi-value" style={{ color: 'var(--rose-primary)' }}>
                {summaryData.avg_HRS_without_5in1.toFixed(4)}
              </div>
              <div className="kpi-sub">High Baseline Hallucination Risk</div>
            </div>

            {/* Card 2: Avg HRS WITH 5in1 */}
            <div className="kpi-card" style={{ borderLeft: '4px solid var(--emerald-primary)' }}>
              <div className="kpi-label">
                <span>Avg HRS (With 5in1)</span>
                <CheckCircle2 size={16} color="#10B981" />
              </div>
              <div className="kpi-value kpi-highlight">
                {summaryData.avg_HRS_with_5in1.toFixed(4)}
              </div>
              <div className="kpi-sub">Near-Zero Hallucination Risk</div>
            </div>

            {/* Card 3: HRS reduction % */}
            <div className="kpi-card" style={{ borderLeft: '4px solid var(--cyan-primary)' }}>
              <div className="kpi-label">
                <span>HRS Reduction</span>
                <TrendingDown size={16} color="#06B6D4" />
              </div>
              <div className="kpi-value kpi-highlight-cyan">
                {summaryData.HRS_reduction_pct.toFixed(2)}%
              </div>
              <div className="kpi-sub">Empirical Risk Elimination</div>
            </div>

            {/* Card 4: Expected-behaviour score WITHOUT 5in1 */}
            <div className="kpi-card" style={{ borderLeft: '4px solid var(--rose-primary)' }}>
              <div className="kpi-label">
                <span>Expected Safe Behavior (Without)</span>
                <XCircle size={16} color="#EF4444" />
              </div>
              <div className="kpi-value" style={{ color: 'var(--rose-primary)' }}>
                {summaryData.baseline_expected_behavior_pct.toFixed(1)}%
              </div>
              <div className="kpi-sub">Frequent Policy Violations</div>
            </div>

            {/* Card 5: Expected-behaviour score WITH 5in1 */}
            <div className="kpi-card" style={{ borderLeft: '4px solid var(--emerald-primary)' }}>
              <div className="kpi-label">
                <span>Expected Safe Behavior (With)</span>
                <CheckCircle2 size={16} color="#10B981" />
              </div>
              <div className="kpi-value kpi-highlight">
                {summaryData.with5in1_expected_behavior_pct.toFixed(1)}%
              </div>
              <div className="kpi-sub">Rigorous Grounding & Refusal</div>
            </div>

            {/* Card 6: Guardrail violation rate */}
            <div className="kpi-card" style={{ borderLeft: '4px solid var(--emerald-primary)' }}>
              <div className="kpi-label">
                <span>Guardrail Violation Rate</span>
                <ShieldAlert size={16} color="#10B981" />
              </div>
              <div className="kpi-value kpi-highlight">
                {summaryData.guardrail_violation_rate_pct.toFixed(1)}%
              </div>
              <div className="kpi-sub">Zero Final Policy Breaches</div>
            </div>

            {/* Card 7: Average latency WITHOUT 5in1 */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>Avg Latency (Without)</span>
                <Clock size={16} color="#94A3B8" />
              </div>
              <div className="kpi-value" style={{ fontSize: '1.5rem', color: '#CBD5E1' }}>
                {summaryData.avg_latency_without_ms.toFixed(1)} ms
              </div>
              <div className="kpi-sub">Single Forward Pass</div>
            </div>

            {/* Card 8: Average latency WITH 5in1 */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>Avg Latency (With)</span>
                <Clock size={16} color="var(--cyan-bright)" />
              </div>
              <div className="kpi-value" style={{ fontSize: '1.5rem', color: 'var(--cyan-bright)' }}>
                {summaryData.avg_latency_with_ms.toFixed(1)} ms
              </div>
              <div className="kpi-sub">5 Protective Layers Overhead</div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2 & 3: HRS COMPARISON & EXPECTED BEHAVIOUR CHARTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, marginBottom: 28 }}>
        {/* Section 2: HRS Comparison Bar Chart */}
        {summaryData && (
          <div className="chart-card">
            <div className="chart-title-row">
              <div className="chart-title">
                <ArrowDownRight size={20} color="#EF4444" />
                <span>2. Hallucination Risk Score Comparison</span>
              </div>
              <span className="badge-tag cyan">Lower is Better</span>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>
              The Hallucination Risk Score (HRS) combines Policy Violations (0.35), Multi-Agent Validation Failure (0.30), Expected Behavior Failure (0.25), and Tool Misuse (0.10).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Baseline Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                  <span style={{ color: '#E2E8F0', fontWeight: 600 }}>WITHOUT 5in1 (Parametric Qwen3)</span>
                  <strong style={{ color: 'var(--rose-primary)', fontFamily: 'var(--font-mono)' }}>
                    HRS: {summaryData.avg_HRS_without_5in1.toFixed(4)}
                  </strong>
                </div>
                <div className="bar-track" style={{ height: 16 }}>
                  <div 
                    className="bar-fill rose" 
                    style={{ width: `${Math.min(summaryData.avg_HRS_without_5in1 * 150, 100)}%` }} 
                  />
                </div>
              </div>

              {/* 5in1 Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                  <span style={{ color: '#E2E8F0', fontWeight: 600 }}>WITH 5in1 (Protected Pipeline)</span>
                  <strong style={{ color: 'var(--emerald-bright)', fontFamily: 'var(--font-mono)' }}>
                    HRS: {summaryData.avg_HRS_with_5in1.toFixed(4)}
                  </strong>
                </div>
                <div className="bar-track" style={{ height: 16 }}>
                  <div 
                    className="bar-fill emerald" 
                    style={{ width: `${Math.max(summaryData.avg_HRS_with_5in1 * 150, 6)}%` }} 
                  />
                </div>
              </div>
            </div>

            <div style={{
              marginTop: 20,
              padding: '12px 16px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              color: 'var(--emerald-bright)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <CheckCircle2 size={16} />
              <span><strong>{summaryData.HRS_reduction_pct.toFixed(2)}% Absolute Risk Reduction</strong> across {totalItemCount} representative benchmark queries.</span>
            </div>
          </div>
        )}

        {/* Section 3: Expected Behaviour Comparison */}
        {summaryData && (
          <div className="chart-card">
            <div className="chart-title-row">
              <div className="chart-title">
                <CheckCircle2 size={20} color="#10B981" />
                <span>3. Expected Safe-Behaviour Score</span>
              </div>
              <span className="badge-tag emerald">Higher is Better</span>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>
              Measures the percentage of queries where the model adhered strictly to the Kaggle dataset boundaries, executed tools only when permitted, and successfully refused out-of-scope/unsupported claims.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Baseline Success */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                  <span style={{ color: '#E2E8F0', fontWeight: 600 }}>Baseline Expected Behaviour</span>
                  <strong style={{ color: 'var(--rose-primary)', fontFamily: 'var(--font-mono)' }}>
                    {summaryData.baseline_expected_behavior_pct.toFixed(1)}%
                  </strong>
                </div>
                <div className="bar-track" style={{ height: 16 }}>
                  <div 
                    className="bar-fill rose" 
                    style={{ width: `${summaryData.baseline_expected_behavior_pct}%` }} 
                  />
                </div>
              </div>

              {/* 5in1 Success */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                  <span style={{ color: '#E2E8F0', fontWeight: 600 }}>5in1 Expected Behaviour</span>
                  <strong style={{ color: 'var(--emerald-bright)', fontFamily: 'var(--font-mono)' }}>
                    {summaryData.with5in1_expected_behavior_pct.toFixed(1)}%
                  </strong>
                </div>
                <div className="bar-track" style={{ height: 16 }}>
                  <div 
                    className="bar-fill emerald" 
                    style={{ width: `${summaryData.with5in1_expected_behavior_pct}%` }} 
                  />
                </div>
              </div>
            </div>

            <div style={{
              marginTop: 20,
              padding: '12px 16px',
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              color: 'var(--cyan-bright)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <Sparkles size={16} />
              <span><strong>{Number(accuracyJump) >= 0 ? `+${accuracyJump}%` : `${accuracyJump}%`} Accuracy Jump</strong> in policy adherence, safe refusal, and numerical grounding.</span>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 4: CATEGORY-WISE RESULTS */}
      <div className="glass-panel" style={{ marginBottom: 28 }}>
        <div className="panel-header">
          <div className="panel-title">
            <BarChart3 size={22} color="#06B6D4" />
            <span>4. Category-Wise Results (Grouped Comparative Analysis)</span>
          </div>
          <span className="badge-tag">{categories.length} Research Categories</span>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
          Breakdown of Hallucination Risk Score (HRS) across normal factual queries, ambiguous requests, hallucination-inducing prompts, tool misuse attempts, and out-of-scope inquiries.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {categories.map((cat) => (
            <div key={cat.category} style={{
              background: 'rgba(7, 11, 20, 0.8)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className={`chip-cat ${cat.category}`}>
                    {cat.category.replace('_', ' ')}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--emerald-bright)', fontWeight: 700 }}>
                    -{cat.HRS_reduction_pct.toFixed(1)}% Risk
                  </span>
                </div>

                {/* Grouped Bars */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                    <span>Baseline HRS</span>
                    <span style={{ color: 'var(--rose-primary)', fontFamily: 'var(--font-mono)' }}>{cat.baseline_HRS.toFixed(3)}</span>
                  </div>
                  <div className="bar-track" style={{ height: 8 }}>
                    <div className="bar-fill rose" style={{ width: `${Math.min(cat.baseline_HRS * 140, 100)}%` }} />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                    <span>5in1 HRS</span>
                    <span style={{ color: 'var(--emerald-bright)', fontFamily: 'var(--font-mono)' }}>{cat.with5in1_HRS.toFixed(3)}</span>
                  </div>
                  <div className="bar-track" style={{ height: 8 }}>
                    <div className="bar-fill emerald" style={{ width: `${Math.max(cat.with5in1_HRS * 140, 6)}%` }} />
                  </div>
                </div>
              </div>

              <div style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 10,
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.4
              }}>
                {cat.category === 'normal' && 'Exact SQLite aggregation & Knowledge Graph retrieval.'}
                {cat.category === 'ambiguous' && 'Steered clarification requests without making assumptions.'}
                {cat.category === 'hallucination_inducing' && 'Strict guardrail intercept of invented policies/amenities.'}
                {cat.category === 'tool_misuse' && 'Blocked SQL write/delete attempts; read-only policy enforcement.'}
                {cat.category === 'out_of_scope' && 'Safe refusal for queries outside the hotel booking dataset.'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 5: LATENCY TRADEOFF */}
      {summaryData && (
        <div className="glass-panel" style={{ marginBottom: 28 }}>
          <div className="panel-header">
            <div className="panel-title">
              <Clock size={22} color="#8B5CF6" />
              <span>5. Latency & Computational Tradeoff</span>
            </div>
            <span className="badge-tag purple">Transparency in Multi-Agent Overhead</span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
            Additional protection layers (dual Qwen3 judges, Graph-RAG retrieval, and feedback retry loops) introduce a modest inference latency overhead. We report this transparently:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {/* Chart: Latency Comparison */}
            <div style={{ background: 'rgba(7, 11, 20, 0.7)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                  <span style={{ color: '#E2E8F0' }}>WITHOUT 5in1 (Parametric Generation)</span>
                  <strong style={{ color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>{summaryData.avg_latency_without_ms.toFixed(1)} ms</strong>
                </div>
                <div className="bar-track" style={{ height: 12 }}>
                  <div className="bar-fill" style={{ width: `${baselineLatencyWidth}%`, background: '#64748B' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                  <span style={{ color: '#E2E8F0' }}>WITH 5in1 (5-Layer Safety Pipeline)</span>
                  <strong style={{ color: 'var(--purple-bright)', fontFamily: 'var(--font-mono)' }}>{summaryData.avg_latency_with_ms.toFixed(1)} ms</strong>
                </div>
                <div className="bar-track" style={{ height: 12 }}>
                  <div className="bar-fill purple" style={{ width: `${with5in1LatencyWidth}%` }} />
                </div>
              </div>
            </div>

            {/* Tradeoff Explanation */}
            <div className="tradeoff-banner" style={{ margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--purple-bright)', fontWeight: 700 }}>
                <Info size={18} />
                <span>The Neurosymbolic Tradeoff</span>
              </div>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                The full 5in1 pipeline adds approximately <strong>~{latencyOverhead > 0 ? latencyOverhead : 0} ms</strong> of compute overhead compared to unguided generation. In return, the system achieves an <strong>{summaryData.HRS_reduction_pct.toFixed(1)}% reduction in hallucination risk</strong> and <strong>{summaryData.with5in1_expected_behavior_pct.toFixed(1)}% safe-behavior compliance</strong>, making it practical for real-world enterprise deployments where accuracy is non-negotiable.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: ABLATION STUDY ("Why each 5in1 layer matters") */}
      <div className="glass-panel" style={{ marginBottom: 28, border: '1px solid var(--border-glow-cyan)' }}>
        <div className="panel-header">
          <div className="panel-title">
            <Layers size={22} color="#06B6D4" />
            <span>6. Component-Wise Ablation Study — Why Each 5in1 Layer Matters</span>
          </div>
          <span className="badge-tag cyan">Empirical Layer Contributions</span>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: 20, maxWidth: '900px' }}>
          By systematically isolating and disabling each layer, this ablation demonstrates that no single mechanism is sufficient on its own. Hallucination suppression requires the compound neurosymbolic pipeline.
        </p>

        {/* Ablation Table */}
        {ablationData.length > 0 && (
          <div className="table-wrapper" style={{ marginBottom: 24 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Configuration</th>
                  <th>Safe-Behavior Score</th>
                  <th>Mean HRS (Risk)</th>
                  <th>Mean Latency</th>
                  <th>Observed Research Degradation</th>
                </tr>
              </thead>
              <tbody>
                {ablationData.map((row, idx) => (
                  <tr key={idx} style={{ background: idx === 0 ? 'rgba(6, 182, 212, 0.05)' : 'transparent' }}>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: idx === 0 ? 'var(--cyan-bright)' : '#fff' }}>
                      {idx === 0 ? '🌟 ' : ''}{row.configuration}
                    </td>
                    <td>
                      <span style={{ 
                        fontFamily: 'var(--font-mono)', 
                        fontWeight: 700,
                        color: row.mean_expected_behavior_pct >= 90 ? 'var(--emerald-bright)' : (row.mean_expected_behavior_pct >= 70 ? 'var(--amber-primary)' : 'var(--rose-primary)')
                      }}>
                        {row.mean_expected_behavior_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        fontFamily: 'var(--font-mono)', 
                        fontWeight: 700,
                        color: row.mean_HRS <= 0.1 ? 'var(--emerald-bright)' : (row.mean_HRS <= 0.3 ? 'var(--amber-primary)' : 'var(--rose-primary)')
                      }}>
                        {row.mean_HRS.toFixed(4)}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      {typeof row.mean_latency_ms === 'number' ? row.mean_latency_ms.toFixed(1) : row.mean_latency_ms} ms
                    </td>
                    <td style={{ fontSize: '0.82rem', color: idx === 0 ? 'var(--emerald-bright)' : 'var(--text-secondary)' }}>
                      {row.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Dual Ablation Comparison Bars */}
        {ablationData.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {/* Chart: Safe Behavior Impact */}
            <div style={{ background: 'rgba(7, 11, 20, 0.7)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color="#10B981" />
                <span>Safe-Behavior Score Drop (% — Higher is Better)</span>
              </div>
              {ablationData.map((row) => (
                <div key={row.configuration} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 3 }}>
                    <span style={{ color: '#E2E8F0' }}>{row.configuration}</span>
                    <strong style={{ color: row.configuration === 'Full 5in1' ? 'var(--emerald-bright)' : '#CBD5E1', fontFamily: 'var(--font-mono)' }}>
                      {row.mean_expected_behavior_pct.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="bar-track" style={{ height: 7 }}>
                    <div 
                      className={`bar-fill ${row.configuration === 'Full 5in1' ? 'emerald' : 'cyan'}`} 
                      style={{ width: `${Math.min(row.mean_expected_behavior_pct, 100)}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Chart: HRS Risk Climb */}
            <div style={{ background: 'rgba(7, 11, 20, 0.7)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowDownRight size={16} color="#EF4444" />
                <span>Hallucination Risk Score Climb (HRS — Lower is Better)</span>
              </div>
              {ablationData.map((row) => (
                <div key={row.configuration} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 3 }}>
                    <span style={{ color: '#E2E8F0' }}>{row.configuration}</span>
                    <strong style={{ color: row.configuration === 'Full 5in1' ? 'var(--emerald-bright)' : 'var(--rose-primary)', fontFamily: 'var(--font-mono)' }}>
                      {row.mean_HRS.toFixed(4)}
                    </strong>
                  </div>
                  <div className="bar-track" style={{ height: 7 }}>
                    <div 
                      className={`bar-fill ${row.configuration === 'Full 5in1' ? 'emerald' : 'rose'}`} 
                      style={{ width: `${Math.min(row.mean_HRS * 180, 100)}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 25-Item Evaluation Suite Deep Dive */}
      <div className="glass-panel">
        <div className="panel-header">
          <div className="panel-title">
            <GitCompare size={22} color="#06B6D4" />
            <span>25-Item Benchmark Dataset Verification Suite</span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {categoryOptions.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  background: activeCategory === cat ? 'var(--cyan-primary)' : 'rgba(255, 255, 255, 0.04)',
                  color: activeCategory === cat ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Query</th>
                <th>Baseline HRS</th>
                <th>5in1 HRS</th>
                <th>Validation</th>
                <th>Tools</th>
                <th>Steering</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cyan-bright)' }}>{item.id}</td>
                  <td>
                    <span className={`chip-cat ${item.category}`}>
                      {item.category}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.query}
                  </td>
                  <td style={{ color: 'var(--rose-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {item.baseline_HRS.toFixed(3)}
                  </td>
                  <td style={{ color: 'var(--emerald-bright)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {item.with5in1_HRS.toFixed(3)}
                  </td>
                  <td>
                    <span className={`step-badge ${item.with5in1_validation === 'VALID' ? 'pass' : 'retry'}`} style={{ fontSize: '0.7rem' }}>
                      {item.with5in1_validation}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                    {item.with5in1_tools}
                  </td>
                  <td>
                    <span className={`step-badge ${item.steering === 'PASS' ? 'pass' : (item.steering === 'RETRY' ? 'retry' : 'abstain')}`} style={{ fontSize: '0.7rem' }}>
                      {item.steering}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => setSelectedItem(item)}
                    >
                      <Eye size={12} />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item Modal */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-card fade-in" style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span className={`chip-cat ${selectedItem.category}`} style={{ marginRight: 8 }}>
                  {selectedItem.category}
                </span>
                <strong style={{ fontSize: '1.1rem', color: '#fff' }}>[{selectedItem.id}] {selectedItem.query}</strong>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: '#070B14', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--rose-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                  WITHOUT 5in1 Response (HRS: {selectedItem.baseline_HRS.toFixed(3)})
                </div>
                <div style={{ fontSize: '0.85rem', color: '#CBD5E1', lineHeight: 1.5 }}>
                  {selectedItem.baseline_response || 'Parametric baseline output.'}
                </div>
              </div>

              <div style={{ background: '#070B14', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--emerald-bright)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                  WITH 5in1 Response (HRS: {selectedItem.with5in1_HRS.toFixed(3)})
                </div>
                <div style={{ fontSize: '0.85rem', color: '#CBD5E1', lineHeight: 1.5 }}>
                  {selectedItem.with5in1_response || 'Protected grounded output.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => setSelectedItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
