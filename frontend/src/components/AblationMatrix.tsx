'use client';

import React, { useState, useEffect } from 'react';
import { getAblationResults } from '@/lib/api';
import { AblationConfig } from '@/types';
import { Layers, BarChart2, ArrowDownRight } from 'lucide-react';

interface AblationMatrixProps {
  isConnected: boolean;
}

export default function AblationMatrix({ isConnected }: AblationMatrixProps) {
  const [data, setData] = useState<AblationConfig[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await getAblationResults();
        if (res?.configurations) setData(res.configurations);
      } catch (err) {
        console.error('Failed to load ablation results:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="fade-in">
      <div className="glass-panel">
        <div className="panel-header">
          <div className="panel-title">
            <Layers size={22} color="var(--accent-primary)" />
            <span>Component-Wise Ablation Study (6 Research Configurations)</span>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20, maxWidth: '850px' }}>
          This execution-based ablation removes each protective layer independently to measure its empirical impact on <strong>Expected Safe Behavior (%)</strong>, <strong>Hallucination Risk Score (HRS)</strong>, and <strong>Inference Latency</strong>.
        </p>

        {/* Ablation Table */}
        {data.length > 0 && (
          <div className="table-wrapper" style={{ marginBottom: 28 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Configuration</th>
                  <th>Mean Safe-Behavior</th>
                  <th>Mean HRS (Risk)</th>
                  <th>Mean Latency</th>
                  <th>Research Impact & Description</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} style={{ background: idx === 0 ? 'var(--accent-wash)' : 'transparent' }}>
                    <td style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, color: idx === 0 ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {idx === 0 ? '★ ' : ''}{row.configuration}
                    </td>
                    <td>
                      <span style={{ 
                        fontFamily: 'var(--font-mono)', 
                        fontWeight: 700,
                        color: row.mean_expected_behavior_pct >= 90 ? 'var(--pass-green)' : (row.mean_expected_behavior_pct >= 70 ? 'var(--amber-primary)' : 'var(--fail-red)')
                      }}>
                        {row.mean_expected_behavior_pct}%
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        fontFamily: 'var(--font-mono)', 
                        fontWeight: 700,
                        color: row.mean_HRS <= 0.1 ? 'var(--pass-green)' : (row.mean_HRS <= 0.3 ? 'var(--amber-primary)' : 'var(--fail-red)')
                      }}>
                        {row.mean_HRS.toFixed(4)}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {row.mean_latency_ms} ms
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {row.description || 'Ablation variant'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Visual Comparison Bars */}
        {data.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {/* Chart 1: Safe Behavior Score */}
            <div style={{ background: 'var(--bg-subtle)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={16} color="var(--pass-green)" />
                <span>Expected Safe-Behavior Score (%) — Higher is Better</span>
              </div>

              {data.map((row) => (
                <div key={row.configuration} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{row.configuration}</span>
                    <strong style={{ color: 'var(--pass-green)', fontFamily: 'var(--font-mono)' }}>{row.mean_expected_behavior_pct}%</strong>
                  </div>
                  <div style={{ height: 8, background: '#E4E4DD', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${row.mean_expected_behavior_pct}%`, 
                      background: row.configuration === 'Full 5in1' ? 'var(--accent-primary)' : 'var(--pass-green)',
                      borderRadius: 4
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Chart 2: Hallucination Risk Score */}
            <div style={{ background: 'var(--bg-subtle)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowDownRight size={16} color="var(--fail-red)" />
                <span>Hallucination Risk Score (HRS) — Lower is Better</span>
              </div>

              {data.map((row) => (
                <div key={row.configuration} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{row.configuration}</span>
                    <strong style={{ color: 'var(--fail-red)', fontFamily: 'var(--font-mono)' }}>{row.mean_HRS.toFixed(4)}</strong>
                  </div>
                  <div style={{ height: 8, background: '#E4E4DD', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${Math.min(row.mean_HRS * 180, 100)}%`, 
                      background: row.configuration === 'Full 5in1' ? 'var(--pass-green)' : 'var(--fail-red)',
                      borderRadius: 4
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
