'use client';

import React, { useState, useEffect } from 'react';
import { getKnowledgeGraph, getDatasetStats } from '@/lib/api';
import { Database, Network, Search, AlertCircle, RefreshCw } from 'lucide-react';

interface KnowledgeGraphViewerProps {
  isConnected: boolean;
}

export default function KnowledgeGraphViewer({ isConnected }: KnowledgeGraphViewerProps) {
  const [graphData, setGraphData] = useState<{ facts: string[] } | null>(null);
  const [datasetStats, setDatasetStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filterTerm, setFilterTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [gRes, sRes] = await Promise.all([
        getKnowledgeGraph(),
        getDatasetStats()
      ]);
      if (gRes) setGraphData(gRes);
      if (sRes) setDatasetStats(sRes);
    } catch (err) {
      console.error('Failed to load graph/dataset stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredFacts = (graphData?.facts || []).filter(f => 
    !filterTerm.trim() || f.toLowerCase().includes(filterTerm.toLowerCase())
  );

  return (
    <div className="fade-in">
      {/* Knowledge Graph Fact Triples */}
      <div className="glass-panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div className="panel-title">
            <Network size={22} color="#06B6D4" />
            <span>Graph-RAG Knowledge Graph (22 Aggregate Fact Triples)</span>
          </div>
          <button 
            className="btn-secondary" 
            onClick={fetchData} 
            disabled={loading}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 16 }}>
          Pre-built factual Knowledge Graph populated from the SQLite dataset layer and retrieved via cosine similarity of 384-dimensional lexical n-gram hash embeddings.
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input 
              type="text"
              className="query-input"
              style={{ paddingLeft: 36, width: '100%', padding: '10px 14px 10px 36px', fontSize: '0.88rem' }}
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              placeholder="Filter facts (e.g. City Hotel, ADR)..."
            />
          </div>
        </div>

        {graphData ? (
          <div style={{
            background: '#040711',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '16px',
            maxHeight: '340px',
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            lineHeight: 1.6
          }}>
            {filteredFacts.length > 0 ? (
              filteredFacts.map((fact, idx) => (
                <div key={idx} style={{ 
                  padding: '6px 0', 
                  borderBottom: idx < filteredFacts.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                  color: fact.includes('City Hotel') ? 'var(--cyan-bright)' : 'var(--emerald-bright)'
                }}>
                  • {fact}
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>No facts matched your filter.</div>
            )}
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {loading ? 'Fetching Graph-RAG facts from Colab...' : 'Knowledge Graph facts will appear when served by the Colab backend.'}
          </div>
        )}
      </div>

      {/* Dataset Overview & Sample Records */}
      {datasetStats && (
        <div className="glass-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Database size={22} color="#06B6D4" />
              <span>Kaggle Dataset Layer ({datasetStats.total_rows?.toLocaleString()} Total Records)</span>
            </div>
            <span className="badge-tag cyan">mojtaba142/hotel-booking</span>
          </div>

          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Booking Ref</th>
                  <th>Hotel</th>
                  <th>Canceled?</th>
                  <th>Year</th>
                  <th>Month</th>
                  <th>ADR</th>
                  <th>Room Type</th>
                  <th>Segment</th>
                </tr>
              </thead>
              <tbody>
                {datasetStats.sample_records?.map((row: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-bright)', fontWeight: 600 }}>{row.booking_ref}</td>
                    <td>{row.hotel}</td>
                    <td>
                      <span className={`step-badge ${row.is_canceled === 1 ? 'fail' : 'pass'}`} style={{ fontSize: '0.7rem' }}>
                        {row.is_canceled === 1 ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td>{row.arrival_date_year}</td>
                    <td>{row.arrival_date_month}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>${row.adr}</td>
                    <td>{row.reserved_room_type}</td>
                    <td>{row.market_segment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
