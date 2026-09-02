'use client';

import React from 'react';
import { HealthResponse } from '@/types';
import { Sparkles, Settings, Activity, Layers, Database } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isConnected: boolean;
  backendInfo: HealthResponse | null;
  onOpenConfig: () => void;
}

export default function Header({
  activeTab,
  setActiveTab,
  isConnected,
  backendInfo,
  onOpenConfig,
}: HeaderProps) {
  return (
    <header className="header-wrapper">
      <div className="header-top">
        <div className="brand-section">
          <div className="brand-badge-row">
            <span className="badge-tag cyan">AI Research Capstone</span>
            <span className="badge-tag purple">Qwen3 8B 4-bit (Colab GPU)</span>
            <span className="badge-tag">Kaggle Hotel Booking</span>
          </div>
          <h1 className="brand-title">5in1 Hotel Agent</h1>
          <h2 className="brand-subtitle">A safer and more grounded Qwen3 hotel-booking agent</h2>
          <p className="brand-desc">
            This research demonstration contrasts the unassisted Qwen3 baseline response against the complete 
            <strong> 5in1 neurosymbolic pipeline</strong> (Graph-RAG, ToolGate, Multi-Agent Validation, Neurosymbolic Guardrails, and Agent Steering) 
            running live on Google Colab GPU runtime.
          </p>
        </div>

        {/* Small Status Indicator: CONNECTED or OFFLINE */}
        <div 
          className="status-pill" 
          onClick={onOpenConfig} 
          title="Click to view or configure Colab API connection"
          style={{
            borderColor: isConnected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
            background: isConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            padding: '6px 12px'
          }}
        >
          <div className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
          <div className="status-text">
            {isConnected ? (
              <strong style={{ color: 'var(--emerald-bright)', letterSpacing: '0.05em' }}>CONNECTED</strong>
            ) : (
              <strong style={{ color: 'var(--rose-bright)', letterSpacing: '0.05em' }}>OFFLINE</strong>
            )}
          </div>
          <Settings size={13} color="#94A3B8" style={{ marginLeft: 4 }} />
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button 
          className={`nav-tab ${activeTab === 'inspector' ? 'active' : ''}`}
          onClick={() => setActiveTab('inspector')}
        >
          <Sparkles size={16} />
          <span>Live Inference</span>
        </button>

        <button 
          className={`nav-tab ${activeTab === 'evaluation' ? 'active' : ''}`}
          onClick={() => setActiveTab('evaluation')}
        >
          <Activity size={16} />
          <span>Evaluation Dashboard</span>
        </button>

        <button 
          className={`nav-tab ${activeTab === 'ablation' ? 'active' : ''}`}
          onClick={() => setActiveTab('ablation')}
        >
          <Layers size={16} />
          <span>Ablation Matrix</span>
        </button>

        <button 
          className={`nav-tab ${activeTab === 'graph' ? 'active' : ''}`}
          onClick={() => setActiveTab('graph')}
        >
          <Database size={16} />
          <span>Knowledge Graph & Dataset</span>
        </button>
      </nav>
    </header>
  );
}
