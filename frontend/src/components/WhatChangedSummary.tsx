'use client';

import React from 'react';
import { AnalyzeResponse } from '@/types';
import { 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Zap,
  RotateCw,
  Ban
} from 'lucide-react';

interface WhatChangedSummaryProps {
  data: AnalyzeResponse;
}

export default function WhatChangedSummary({ data }: WhatChangedSummaryProps) {
  const { baseline, fivein1, comparison } = data;

  const getValidationBadge = (verdict: string) => {
    const v = (verdict || '').toUpperCase();
    switch (v) {
      case 'VALID':
        return <span className="step-badge pass"><CheckCircle2 size={12} /> VALID</span>;
      case 'INVALID':
        return <span className="step-badge fail"><XCircle size={12} /> INVALID</span>;
      default:
        return <span className="step-badge retry"><AlertTriangle size={12} /> UNCERTAIN</span>;
    }
  };

  const getGuardrailBadge = (passed: boolean) => {
    return passed 
      ? <span className="step-badge pass"><CheckCircle2 size={12} /> GUARDRAIL PASS</span>
      : <span className="step-badge fail"><XCircle size={12} /> GUARDRAIL FAIL</span>;
  };

  const getSteeringBadge = (action: string) => {
    const a = (action || '').toUpperCase();
    switch (a) {
      case 'PASS':
        return <span className="step-badge pass"><CheckCircle2 size={12} /> STEERING: PASS</span>;
      case 'RETRY':
        return <span className="step-badge retry"><RotateCw size={12} /> STEERING: RETRY</span>;
      default:
        return <span className="step-badge abstain"><Ban size={12} /> STEERING: ABSTAIN</span>;
    }
  };

  const baselineRisk = comparison?.baseline_risk !== undefined ? comparison.baseline_risk.toFixed(4) : null;
  const fivein1Risk = comparison?.fivein1_risk !== undefined ? comparison.fivein1_risk.toFixed(4) : null;
  const riskReduction = comparison?.risk_reduction_pct !== undefined ? `${comparison.risk_reduction_pct.toFixed(1)}%` : null;

  const baselineLatency = comparison?.baseline_latency_ms !== undefined 
    ? comparison.baseline_latency_ms 
    : baseline?.latency_ms;
  const fivein1Latency = comparison?.fivein1_latency_ms !== undefined 
    ? comparison.fivein1_latency_ms 
    : fivein1?.latency_ms;

  const latencyDiff = comparison?.latency_difference_ms !== undefined 
    ? (comparison.latency_difference_ms > 0 ? `+${comparison.latency_difference_ms}` : `${comparison.latency_difference_ms}`)
    : (fivein1Latency && baselineLatency ? `+${(fivein1Latency - baselineLatency).toFixed(1)}` : '0');

  const baselineAnswer = baseline?.answer || '';
  const fivein1Answer = fivein1?.answer || fivein1?.final_answer || '';

  return (
    <div className="glass-panel fade-in" style={{ border: '1px solid var(--border-glow-cyan)', background: 'rgba(6, 182, 212, 0.03)', marginBottom: 24 }}>
      <div className="panel-header" style={{ marginBottom: 14 }}>
        <div className="panel-title" style={{ fontSize: '1.15rem' }}>
          <Zap size={20} color="#06B6D4" />
          <span>What Changed? (Comparative Summary)</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {getValidationBadge(fivein1?.validation?.verdict)}
          {getGuardrailBadge(Boolean(fivein1?.guardrail?.passed))}
          {getSteeringBadge(fivein1?.steering_action)}
        </div>
      </div>

      {/* Visual Risk Indicator Row */}
      <div style={{
        background: 'rgba(7, 11, 20, 0.85)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        marginBottom: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
        alignItems: 'center'
      }}>
        {/* Risk Transition Indicator */}
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 700 }}>
            Hallucination Risk Score Transition
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--rose-primary)' }}>
              {baselineRisk || 'N/A'}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>WITHOUT 5in1</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--cyan-bright)' }}>
              <ArrowRight size={20} />
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--emerald-bright)' }}>
              {fivein1Risk || 'N/A'}
              <span style={{ fontSize: '0.72rem', color: 'var(--emerald-bright)', display: 'block', fontWeight: 500 }}>WITH 5in1</span>
            </div>

            <div style={{
              background: riskReduction ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${riskReduction ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              fontWeight: 800,
              color: riskReduction ? 'var(--emerald-bright)' : '#CBD5E1',
              marginLeft: 'auto'
            }}>
              {riskReduction ? `-${riskReduction} Risk` : 'Grounded Inference'}
            </div>
          </div>
        </div>

        {/* Latency & Overhead Indicator */}
        <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 700 }}>
            Execution Time & Overhead
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: '#CBD5E1' }}>
                {baselineLatency !== undefined ? `${baselineLatency} ms` : 'N/A'} → {fivein1Latency !== undefined ? `${fivein1Latency} ms` : 'N/A'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                Δ {latencyDiff} ms (5 protective layers)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-side Response Snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <div style={{ background: '#040711', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--rose-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Baseline Response (Raw Output)
          </div>
          <div style={{ fontSize: '0.88rem', color: '#CBD5E1', lineHeight: 1.5, maxHeight: '90px', overflowY: 'auto' }}>
            {baselineAnswer}
          </div>
        </div>

        <div style={{ background: '#040711', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--emerald-bright)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            5in1 Grounded Final Answer
          </div>
          <div style={{ fontSize: '0.88rem', color: '#F1F5F9', lineHeight: 1.5, maxHeight: '90px', overflowY: 'auto' }}>
            {fivein1Answer}
          </div>
        </div>
      </div>
    </div>
  );
}
