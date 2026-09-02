'use client';

import React, { useState } from 'react';
import { AnalyzeResponse } from '@/types';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RotateCw, 
  Ban, 
  Code, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';

interface LiveComparisonSectionProps {
  data: AnalyzeResponse;
}

export default function LiveComparisonSection({ data }: LiveComparisonSectionProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const { query, baseline, fivein1, comparison } = data;

  // Direct Field Mappings per user specification:
  // baseline.answer → WITHOUT 5in1 answer
  const without5in1Answer = baseline?.answer || '';
  
  // fivein1.answer → WITH 5in1 final answer
  const with5in1FinalAnswer = fivein1?.answer || fivein1?.final_answer || '';
  
  // fivein1.intent → intent
  const intent = fivein1?.intent || '';
  
  // fivein1.tools_selected → tools
  const tools = fivein1?.tools_selected || [];
  
  // fivein1.rag_context → Graph-RAG information
  const ragContext = fivein1?.rag_context || '';
  
  // fivein1.tool_results → ToolGate result
  const toolResults = fivein1?.tool_results || '';
  
  // fivein1.validation.verdict → validation status
  const validationStatus = fivein1?.validation?.verdict || '';
  
  // fivein1.validation.confidence → validation confidence
  const validationConfidence = fivein1?.validation?.confidence !== undefined ? fivein1.validation.confidence : null;
  
  // fivein1.validation.issues → validation issues
  const validationIssues = fivein1?.validation?.issues || [];
  
  // fivein1.guardrail.passed → guardrail status
  const guardrailStatus = Boolean(fivein1?.guardrail?.passed);
  
  // fivein1.guardrail.violations → guardrail violations
  const guardrailViolations = fivein1?.guardrail?.violations || [];
  
  // fivein1.steering_action → steering
  const steering = fivein1?.steering_action || '';
  
  // fivein1.retries → retries
  const retries = fivein1?.retries !== undefined ? fivein1.retries : 0;

  // comparison.baseline_latency_ms → baseline latency
  const baselineLatency = comparison?.baseline_latency_ms !== undefined 
    ? comparison.baseline_latency_ms 
    : baseline?.latency_ms;

  // comparison.fivein1_latency_ms → 5in1 latency
  const fivein1Latency = comparison?.fivein1_latency_ms !== undefined 
    ? comparison.fivein1_latency_ms 
    : fivein1?.latency_ms;

  // comparison.baseline_risk → baseline risk
  const baselineRisk = comparison?.baseline_risk !== undefined ? comparison.baseline_risk : null;

  // comparison.fivein1_risk → 5in1 risk
  const fivein1Risk = comparison?.fivein1_risk !== undefined ? comparison.fivein1_risk : null;

  // comparison.risk_reduction_pct → risk reduction
  const riskReduction = comparison?.risk_reduction_pct !== undefined ? comparison.risk_reduction_pct : null;

  // Baseline violations
  const baselineViolations = baseline?.violations || [];
  const baselineViolationCount = baseline?.violation_count !== undefined ? baseline.violation_count : baselineViolations.length;

  const renderValidationBadge = (verdict: string) => {
    const v = (verdict || '').toUpperCase();
    if (v === 'VALID') {
      return <span className="step-badge pass"><CheckCircle2 size={12} /> VALID</span>;
    }
    if (v === 'INVALID') {
      return <span className="step-badge fail"><XCircle size={12} /> INVALID</span>;
    }
    return <span className="step-badge retry"><AlertTriangle size={12} /> UNCERTAIN</span>;
  };

  const renderGuardrailBadge = (passed: boolean) => {
    return passed 
      ? <span className="step-badge pass"><CheckCircle2 size={12} /> PASS</span>
      : <span className="step-badge fail"><XCircle size={12} /> FAIL</span>;
  };

  const renderSteeringBadge = (action: string) => {
    const a = (action || '').toUpperCase();
    if (a === 'PASS') {
      return <span className="step-badge pass"><CheckCircle2 size={12} /> PASS</span>;
    }
    if (a === 'RETRY') {
      return <span className="step-badge retry"><RotateCw size={12} /> RETRY</span>;
    }
    return <span className="step-badge abstain"><Ban size={12} /> ABSTAIN</span>;
  };

  return (
    <div className="fade-in" style={{ marginBottom: 28 }}>
      {/* 1. DIRECT COMPARISON SECTION */}
      <div className="glass-panel" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)', marginBottom: 20 }}>
        <div className="panel-header" style={{ marginBottom: 14 }}>
          <h3 className="panel-title" style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>
            Comparative Audit Summary
          </h3>
          <span className="badge-tag">Query: {query}</span>
        </div>

        {/* Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 16
        }}>
          {/* Baseline Latency */}
          <div className="comp-meta-item">
            <span className="comp-meta-label">Baseline Latency</span>
            <span className="comp-meta-val" style={{ color: 'var(--text-secondary)' }}>
              {baselineLatency !== undefined ? `${baselineLatency} ms` : 'N/A'}
            </span>
          </div>

          {/* 5in1 Latency */}
          <div className="comp-meta-item">
            <span className="comp-meta-label">5in1 Pipeline Latency</span>
            <span className="comp-meta-val" style={{ color: 'var(--accent-primary)' }}>
              {fivein1Latency !== undefined ? `${fivein1Latency} ms` : 'N/A'}
            </span>
          </div>

          {/* Baseline Risk */}
          <div className="comp-meta-item">
            <span className="comp-meta-label">Baseline Risk (HRS)</span>
            <span className="comp-meta-val" style={{ color: baselineRisk !== null ? 'var(--fail-red)' : 'var(--text-muted)' }}>
              {baselineRisk !== null ? baselineRisk.toFixed(4) : 'N/A'}
            </span>
          </div>

          {/* 5in1 Risk */}
          <div className="comp-meta-item">
            <span className="comp-meta-label">5in1 Risk (HRS)</span>
            <span className="comp-meta-val" style={{ color: fivein1Risk !== null ? 'var(--pass-green)' : 'var(--text-muted)' }}>
              {fivein1Risk !== null ? fivein1Risk.toFixed(4) : 'N/A'}
            </span>
          </div>

          {/* Risk Reduction */}
          <div className="comp-meta-item">
            <span className="comp-meta-label">Risk Reduction</span>
            <span className="comp-meta-val" style={{ color: riskReduction !== null ? 'var(--pass-green)' : 'var(--text-muted)' }}>
              {riskReduction !== null ? `-${riskReduction.toFixed(1)}%` : 'N/A'}
            </span>
          </div>
        </div>

        {/* Direct Answer Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <div style={{ background: '#FAF8F6', padding: '14px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid #F1ECE6' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--fail-red)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Unassisted Baseline Generation
            </div>
            <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {without5in1Answer}
            </div>
          </div>

          <div style={{ background: '#FFFFFF', padding: '14px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-card)', borderLeft: '3px solid var(--pass-green)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--pass-green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              5in1 Grounded Final Answer
            </div>
            <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.6, fontWeight: 500 }}>
              {with5in1FinalAnswer}
            </div>
          </div>
        </div>
      </div>

      {/* 2. SIDE-BY-SIDE RESULT CARDS */}
      <div className="comparison-container">
        {/* WITHOUT 5in1 RESULT CARD */}
        <div className="comp-column baseline">
          <div className="comp-header">
            <div>
              <div className="comp-title" style={{ color: 'var(--rose-primary)' }}>
                WITHOUT 5in1
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Unassisted Qwen3 Parametric Baseline
              </div>
            </div>
            {renderGuardrailBadge(baseline?.guardrail_passed !== undefined ? baseline.guardrail_passed : (baselineViolationCount === 0))}
          </div>

          {/* WITHOUT 5in1 answer */}
          <div className="comp-response-box" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
              Answer:
            </div>
            {without5in1Answer}
          </div>

          <div className="comp-details-list">
            <div className="comp-detail-row">
              <span style={{ color: 'var(--text-muted)' }}>Latency:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {baselineLatency !== undefined ? `${baselineLatency} ms` : 'N/A'}
              </span>
            </div>

            <div className="comp-detail-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Guardrail Violations:</span>
              {baselineViolations.length > 0 ? (
                <ul style={{ paddingLeft: 18, color: 'var(--rose-bright)', fontSize: '0.82rem' }}>
                  {baselineViolations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              ) : (
                <span style={{ color: 'var(--emerald-bright)', fontSize: '0.82rem' }}>None</span>
              )}
            </div>
          </div>
        </div>

        {/* WITH 5in1 RESULT CARD */}
        <div className="comp-column fivein1">
          <div className="comp-header">
            <div>
              <div className="comp-title" style={{ color: 'var(--emerald-bright)' }}>
                WITH 5in1
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Grounded 5in1 Neurosymbolic Pipeline
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {renderValidationBadge(validationStatus)}
              {renderGuardrailBadge(guardrailStatus)}
            </div>
          </div>

          {/* WITH 5in1 final answer */}
          <div className="comp-response-box" style={{ borderLeft: '3px solid var(--emerald-primary)', marginBottom: 14 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--emerald-bright)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
              Final Answer:
            </div>
            {with5in1FinalAnswer}
          </div>

          <div className="comp-details-list">
            {/* intent */}
            <div className="comp-detail-row">
              <span style={{ color: 'var(--text-muted)' }}>Intent:</span>
              <span className={`chip-cat ${intent}`} style={{ fontSize: '0.72rem' }}>
                {intent}
              </span>
            </div>

            {/* tools */}
            <div className="comp-detail-row">
              <span style={{ color: 'var(--text-muted)' }}>Tools:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: tools.length ? 'var(--cyan-bright)' : 'var(--text-dim)' }}>
                {tools.length ? tools.join(', ') : 'None'}
              </span>
            </div>

            {/* validation status & confidence */}
            <div className="comp-detail-row">
              <span style={{ color: 'var(--text-muted)' }}>Validation Status:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {renderValidationBadge(validationStatus)}
                {validationConfidence !== null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    (confidence: {validationConfidence.toFixed(3)})
                  </span>
                )}
              </div>
            </div>

            {/* validation issues */}
            <div className="comp-detail-row">
              <span style={{ color: 'var(--text-muted)' }}>Validation Issues:</span>
              <span style={{ fontSize: '0.8rem', color: validationIssues.length ? 'var(--rose-primary)' : 'var(--emerald-bright)' }}>
                {validationIssues.length ? validationIssues.join(', ') : 'None'}
              </span>
            </div>

            {/* guardrail status & violations */}
            <div className="comp-detail-row">
              <span style={{ color: 'var(--text-muted)' }}>Guardrail Status:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {renderGuardrailBadge(guardrailStatus)}
                {guardrailViolations.length > 0 && (
                  <span style={{ color: 'var(--rose-primary)', fontSize: '0.78rem' }}>
                    ({guardrailViolations.join(', ')})
                  </span>
                )}
              </div>
            </div>

            {/* steering & retries */}
            <div className="comp-detail-row">
              <span style={{ color: 'var(--text-muted)' }}>Steering:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {renderSteeringBadge(steering)}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  ({retries} retries)
                </span>
              </div>
            </div>

            {/* latency */}
            <div className="comp-detail-row">
              <span style={{ color: 'var(--text-muted)' }}>Latency:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cyan-bright)' }}>
                {fivein1Latency !== undefined ? `${fivein1Latency} ms` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. EXPANDABLE TECHNICAL DETAILS (Graph-RAG & ToolGate Results) */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: 0 }}>
        <button 
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--cyan-bright)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontSize: '0.95rem',
            fontWeight: 700
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Code size={18} />
            <span>Graph-RAG Information & ToolGate Results</span>
          </div>
          {showTechnicalDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showTechnicalDetails && (
          <div className="fade-in" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Graph-RAG information */}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                Graph-RAG Information (rag_context)
              </div>
              <pre className="step-content">
                {ragContext || 'None'}
              </pre>
            </div>

            {/* ToolGate result */}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                ToolGate Result (tool_results)
              </div>
              <pre className="step-content">
                {toolResults || 'None'}
              </pre>
            </div>

            {/* Raw Response */}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                Raw Qwen3 Generation (raw_response)
              </div>
              <pre className="step-content">
                {fivein1?.raw_response || 'None'}
              </pre>
            </div>

            {/* Full JSON Payload */}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                Full Returned JSON
              </div>
              <pre className="step-content" style={{ maxHeight: '220px' }}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
