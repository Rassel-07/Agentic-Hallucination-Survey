'use client';

import React, { useState, useEffect } from 'react';
import { getKnowledgeGraph, getDatasetStats } from '@/lib/api';
import { GraphResponse, DatasetStatsResponse, GraphFact } from '@/types';
import { Database, Network, Search, AlertCircle, RefreshCw } from 'lucide-react';

interface KnowledgeGraphViewerProps {
  isConnected: boolean;
}

interface FactTriple {
  subject: string;
  predicate: string;
  object: string;
}

export default function KnowledgeGraphViewer({ isConnected }: KnowledgeGraphViewerProps) {
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [datasetStats, setDatasetStats] = useState<DatasetStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterTerm, setFilterTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gRes, sRes] = await Promise.all([
        getKnowledgeGraph(),
        getDatasetStats()
      ]);
      if (gRes) setGraphData(gRes);
      if (sRes) setDatasetStats(sRes);
      if (!gRes && !sRes) {
        setError('Colab backend offline');
      }
    } catch (err: any) {
      console.error('Failed to load graph/dataset stats from Colab:', err);
      setError('Colab backend offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isConnected]);

  // Normalize facts into structured subject-predicate-object triples
  const rawFacts = graphData?.facts || [];
  const normalizedFacts: FactTriple[] = rawFacts.map((item: any) => {
    if (typeof item === 'object' && item !== null && 'subject' in item) {
      return {
        subject: String(item.subject || ''),
        predicate: String(item.predicate || ''),
        object: String(item.object || ''),
      };
    }
    if (typeof item === 'string') {
      const parts = item.split('|').map(s => s.trim());
      if (parts.length >= 3) {
        return { subject: parts[0], predicate: parts[1], object: parts.slice(2).join(' | ') };
      }
      return { subject: 'Hotel Knowledge', predicate: 'fact', object: item };
    }
    return { subject: 'Hotel Knowledge', predicate: 'attribute', object: JSON.stringify(item) };
  });

  const filteredFacts = normalizedFacts.filter(f => 
    !filterTerm.trim() || 
    f.subject.toLowerCase().includes(filterTerm.toLowerCase()) ||
    f.predicate.toLowerCase().includes(filterTerm.toLowerCase()) ||
    f.object.toLowerCase().includes(filterTerm.toLowerCase())
  );

  const displayedCount = graphData?.count ?? normalizedFacts.length;

  if (!loading && !graphData && !datasetStats) {
    return (
      <div className="glass-panel fade-in" style={{ textAlign: 'center', padding: '50px 20px', border: '1px solid var(--fail-border)' }}>
        <AlertCircle size={36} color="var(--fail-red)" style={{ marginBottom: 14 }} />
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Colab backend offline</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '560px', margin: '0 auto 20px', lineHeight: 1.6 }}>
          {error || 'Unable to retrieve Knowledge Graph or Dataset statistics from Google Colab. Please confirm that your Colab FastAPI server and Cloudflare tunnel are active, then click retry.'}
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

  return (
    <div className="fade-in">
      {/* 1. KNOWLEDGE GRAPH FACT TRIPLES */}
      <div className="glass-panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div className="panel-title">
            <Network size={22} color="var(--accent-primary)" />
            <span>
              Graph-RAG Knowledge Graph {displayedCount > 0 ? `(${displayedCount} Aggregate Fact Triples)` : ''}
            </span>
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
          Pre-built factual Knowledge Graph populated from the SQLite dataset layer and served via <code>GET /graph</code>.
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
              placeholder="Filter facts (subject, predicate, or object)..."
            />
          </div>
        </div>

        {graphData ? (
          <div style={{
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-card)',
            padding: '12px 16px',
            maxHeight: '380px',
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            lineHeight: 1.7
          }}>
            {filteredFacts.length > 0 ? (
              filteredFacts.map((fact, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    padding: '8px 12px', 
                    borderBottom: idx < filteredFacts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 10,
                    flexWrap: 'wrap',
                    background: idx % 2 === 0 ? 'var(--bg-surface)' : 'transparent',
                    borderRadius: 'var(--radius-xs)',
                    margin: '2px 0'
                  }}
                >
                  <span style={{ 
                    fontWeight: 700, 
                    color: fact.subject.includes('City') ? 'var(--accent-primary)' : 'var(--pass-green)' 
                  }}>
                    {fact.subject}
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontFamily: 'var(--font-mono)', 
                    color: 'var(--text-muted)',
                    background: 'var(--bg-subtle)',
                    padding: '1px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle)',
                    textTransform: 'lowercase'
                  }}>
                    {fact.predicate}
                  </span>
                  <span style={{ 
                    fontWeight: 600, 
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)' 
                  }}>
                    {fact.object}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', padding: '12px' }}>No facts matched your filter.</div>
            )}
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {loading ? 'Fetching Graph-RAG facts from Colab...' : 'Knowledge Graph facts will appear when served by the Colab backend.'}
          </div>
        )}
      </div>

      {/* 2. DATASET STATS SECTION */}
      {datasetStats && (
        <div className="glass-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Database size={22} color="var(--accent-primary)" />
              <span>
                Kaggle Dataset Layer {datasetStats.total_rows ? `(${datasetStats.total_rows.toLocaleString()} Total Records)` : ''}
              </span>
            </div>
            <span className="badge-tag cyan">mojtaba142/hotel-booking</span>
          </div>

          {/* Dataset Distribution Cards from Colab API */}
          {datasetStats.hotel_distribution && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
              {Object.entries(datasetStats.hotel_distribution).map(([hotel, count]) => {
                const cancelRate = datasetStats.cancellation_rates?.[hotel];
                const adrStats = datasetStats.adr_statistics?.[hotel];
                return (
                  <div key={hotel} className="comp-meta-item">
                    <span className="comp-meta-label">{hotel} Bookings</span>
                    <span className="comp-meta-val" style={{ color: hotel.includes('City') ? 'var(--accent-primary)' : 'var(--pass-green)' }}>
                      {count.toLocaleString()}
                    </span>
                    {cancelRate !== undefined && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                        Cancellation: {cancelRate}%
                      </span>
                    )}
                    {adrStats && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                        Mean ADR: ${adrStats.mean.toFixed(2)} (Range: ${adrStats.min} – ${adrStats.max})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Aggregated Statistical Table */}
          {datasetStats.hotel_distribution && (
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Hotel Segment</th>
                    <th>Total Bookings</th>
                    <th>Distribution Share</th>
                    <th>Cancellation Rate</th>
                    <th>Mean ADR</th>
                    <th>Min ADR</th>
                    <th>Max ADR</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(datasetStats.hotel_distribution).map(([hotel, count]) => {
                    const share = datasetStats.total_rows ? ((count / datasetStats.total_rows) * 100).toFixed(1) : '—';
                    const cancelRate = datasetStats.cancellation_rates?.[hotel];
                    const adr = datasetStats.adr_statistics?.[hotel];
                    return (
                      <tr key={hotel}>
                        <td style={{ fontWeight: 700, color: hotel.includes('City') ? 'var(--accent-primary)' : 'var(--pass-green)' }}>
                          {hotel}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{count.toLocaleString()}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{share}%</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: cancelRate && cancelRate > 35 ? 'var(--fail-red)' : 'var(--pass-green)' }}>
                          {cancelRate !== undefined ? `${cancelRate}%` : '—'}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {adr?.mean !== undefined ? `$${adr.mean.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {adr?.min !== undefined ? `$${adr.min}` : '—'}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {adr?.max !== undefined ? `$${adr.max}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Sample records if served by Colab */}
          {datasetStats.sample_records && datasetStats.sample_records.length > 0 && (
            <div className="table-wrapper" style={{ marginTop: 20 }}>
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
                  {datasetStats.sample_records.map((row: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600 }}>{row.booking_ref}</td>
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
          )}
        </div>
      )}
    </div>
  );
}
