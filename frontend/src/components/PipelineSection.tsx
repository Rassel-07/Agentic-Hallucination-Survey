'use client';

import React from 'react';
import { AnalyzeResponse } from '@/types';
import { 
  ArrowDown, 
  MessageSquare, 
  Compass, 
  Network, 
  Wrench, 
  Cpu, 
  Scale, 
  ShieldCheck, 
  Navigation, 
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  Ban
} from 'lucide-react';

interface PipelineSectionProps {
  data: AnalyzeResponse;
}

export default function PipelineSection({ data }: PipelineSectionProps) {
  const { query, fivein1 } = data;

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

  const finalAnswer = fivein1?.answer || fivein1?.final_answer || '';
  const intent = fivein1?.intent || '';
  const tools = fivein1?.tools_selected || [];
  const ragContext = fivein1?.rag_context || '';
  const toolResults = fivein1?.tool_results || '';
  const rawResponse = fivein1?.raw_response || '';
  const validationVerdict = fivein1?.validation?.verdict || '';
  const validationConfidence = fivein1?.validation?.confidence !== undefined ? fivein1.validation.confidence : null;
  const validationIssues = fivein1?.validation?.issues || [];
  const guardrailPassed = Boolean(fivein1?.guardrail?.passed);
  const guardrailViolations = fivein1?.guardrail?.violations || [];
  const steeringAction = fivein1?.steering_action || '';
  const retries = fivein1?.retries !== undefined ? fivein1.retries : 0;

  return (
    <div className="glass-panel fade-in">
      <div className="panel-header">
        <div className="panel-title">
          <Navigation size={22} color="var(--accent-primary)" />
          <span>5in1 Pipeline Execution Trace</span>
        </div>
        <span className="badge-tag cyan">
          Latency: {fivein1.latency_ms} ms
        </span>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
        Visual execution sequence across all 5 protective layers, populated directly from the live Colab inference response.
      </p>

      <div className="pipeline-flow">
        {/* 1. USER QUERY */}
        <div className="pipeline-step">
          <div className="step-header">
            <div className="step-title-group">
              <div className="step-number">1</div>
              <div className="step-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} color="var(--accent-primary)" />
                <span>USER QUERY</span>
              </div>
            </div>
            <span className="step-badge cyan">INPUT</span>
          </div>
          <div className="step-content">
            {query}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <ArrowDown size={18} />
        </div>

        {/* 2. INTENT ANALYSIS */}
        <div className="pipeline-step active-layer">
          <div className="step-header">
            <div className="step-title-group">
              <div className="step-number">2</div>
              <div className="step-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Compass size={16} color="var(--accent-primary)" />
                <span>INTENT ANALYSIS</span>
              </div>
            </div>
            <span className={`chip-cat ${intent}`}>
              {intent}
            </span>
          </div>
          <div className="step-content">
            Classified Intent: <strong>{intent}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <ArrowDown size={18} />
        </div>

        {/* 3. GRAPH-RAG */}
        <div className="pipeline-step">
          <div className="step-header">
            <div className="step-title-group">
              <div className="step-number">3</div>
              <div className="step-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Network size={16} color="var(--accent-primary)" />
                <span>GRAPH-RAG</span>
              </div>
            </div>
            <span className="step-badge cyan">FACT TRIPLES</span>
          </div>
          <div className="step-content">
            {ragContext || 'None'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <ArrowDown size={18} />
        </div>

        {/* 4. TOOLGATE */}
        <div className="pipeline-step">
          <div className="step-header">
            <div className="step-title-group">
              <div className="step-number">4</div>
              <div className="step-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wrench size={16} color="var(--accent-primary)" />
                <span>TOOLGATE</span>
              </div>
            </div>
            <span className={`step-badge ${tools.length ? 'pass' : 'abstain'}`}>
              {tools.length ? `TOOLS: ${tools.join(', ')}` : 'NO TOOL EXECUTED'}
            </span>
          </div>
          <div className="step-content">
            {toolResults || 'None'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <ArrowDown size={18} />
        </div>

        {/* 5. QWEN3 */}
        <div className="pipeline-step">
          <div className="step-header">
            <div className="step-title-group">
              <div className="step-number">5</div>
              <div className="step-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={16} color="var(--accent-primary)" />
                <span>QWEN3</span>
              </div>
            </div>
            <span className="step-badge abstain">RAW GENERATION</span>
          </div>
          <div className="step-content">
            {rawResponse || 'None'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <ArrowDown size={18} />
        </div>

        {/* 6. MULTI-AGENT VALIDATION */}
        <div className="pipeline-step">
          <div className="step-header">
            <div className="step-title-group">
              <div className="step-number">6</div>
              <div className="step-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scale size={16} color="var(--accent-primary)" />
                <span>MULTI-AGENT VALIDATION</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {renderValidationBadge(validationVerdict)}
              {validationConfidence !== null && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  (confidence: {validationConfidence.toFixed(3)})
                </span>
              )}
            </div>
          </div>
          <div className="step-content">
            Validation Status: <strong>{validationVerdict}</strong>
            {'\n'}Validation Confidence: <strong>{validationConfidence !== null ? validationConfidence.toFixed(3) : 'N/A'}</strong>
            {'\n'}Validation Issues: {validationIssues.length ? JSON.stringify(validationIssues, null, 2) : 'None'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <ArrowDown size={18} />
        </div>

        {/* 7. NEUROSYMBOLIC GUARDRAILS */}
        <div className="pipeline-step">
          <div className="step-header">
            <div className="step-title-group">
              <div className="step-number">7</div>
              <div className="step-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} color="var(--accent-primary)" />
                <span>NEUROSYMBOLIC GUARDRAILS</span>
              </div>
            </div>
            {renderGuardrailBadge(guardrailPassed)}
          </div>
          <div className="step-content">
            Guardrail Status: <strong>{guardrailPassed ? 'PASS' : 'FAIL'}</strong>
            {guardrailViolations.length > 0 && (
              <div style={{ marginTop: 6, color: 'var(--fail-red)' }}>
                Guardrail Violations: {guardrailViolations.join(', ')}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <ArrowDown size={18} />
        </div>

        {/* 8. STEERING */}
        <div className="pipeline-step active-layer">
          <div className="step-header">
            <div className="step-title-group">
              <div className="step-number">8</div>
              <div className="step-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Navigation size={16} color="var(--accent-primary)" />
                <span>STEERING</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {renderSteeringBadge(steeringAction)}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                ({retries} retries)
              </span>
            </div>
          </div>
          <div className="step-content">
            Steering: <strong>{steeringAction}</strong>
            {'\n'}Retries: <strong>{retries}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <ArrowDown size={18} />
        </div>

        {/* 9. FINAL ANSWER */}
        <div className="pipeline-step" style={{ border: '1px solid var(--pass-border)', background: 'var(--pass-wash)' }}>
          <div className="step-header">
            <div className="step-title-group">
              <div className="step-number" style={{ background: 'var(--pass-green)', color: '#FFFFFF' }}>9</div>
              <div className="step-name" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--pass-green)' }}>
                <CheckCircle size={16} />
                <span>FINAL GROUNDED ANSWER</span>
              </div>
            </div>
            <span className="step-badge pass">VERIFIED</span>
          </div>
          <div className="step-content" style={{ color: 'var(--text-primary)', background: '#FFFFFF', border: '1px solid var(--pass-border)', borderLeft: '4px solid var(--pass-green)', fontSize: '0.94rem', lineHeight: 1.65, fontWeight: 500 }}>
            {finalAnswer}
          </div>
        </div>
      </div>
    </div>
  );
}
