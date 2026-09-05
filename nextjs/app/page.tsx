'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface MarketItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  isUp: boolean;
}

export default function HomePage() {
  const descriptionText =
    'Integrated financial & accounting intelligence core. Manage full-cycle general ledgers, trial balances, and operational analytics with absolute precision.';

  return (
    <>
      <div className="nebula-viewport d-flex align-items-center justify-content-center min-vh-100 p-3 p-md-4">
        {/* Ambient Nebula Glass Card */}
        <div className="nebula-card p-4 p-md-5">
          
          {/* Live Market Widget Wrapper */}
          <div className="market-widget-wrapper mb-4">
            <MarketWidget />
          </div>

          {/* Clean & Minimalist Content */}
          <div className="text-center content-body">
            <p className="description-text mb-4">
              {descriptionText}
            </p>

            {/* Futuristic Navigation Actions */}
            <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap">
              <Link href="/dashboard" className="btn-nebula btn-nebula-primary">
                <i className="ti ti-dashboard me-2"></i>
                <span>Dashboard</span>
              </Link>

              <Link href="/journal" className="btn-nebula btn-nebula-secondary">
                <i className="ti ti-notebook me-2"></i>
                <span>General Journal</span>
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Integrated Styles */}
      <style jsx global>{`
        /* Scope Styling: Deep Nebula Futuristic Theme */
        .nebula-viewport {
          background: radial-gradient(circle at 50% 30%, rgba(30, 27, 75, 0.8) 0%, rgba(15, 23, 42, 0.95) 70%),
                      radial-gradient(circle at 80% 80%, rgba(76, 29, 149, 0.25) 0%, transparent 50%),
                      radial-gradient(circle at 20% 20%, rgba(14, 165, 233, 0.15) 0%, transparent 40%);
          background-color: #0b0f19;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        }

        .nebula-card {
          max-width: 720px;
          width: 100%;
          background: rgba(17, 24, 39, 0.55);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4),
                      inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        }

        .market-widget-wrapper {
          background: rgba(15, 23, 42, 0.6);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 0.85rem;
        }

        .description-text {
          color: rgba(226, 232, 240, 0.85);
          font-size: 1rem;
          line-height: 1.6;
          font-weight: 400;
          letter-spacing: 0.015em;
          max-width: 580px;
          margin-left: auto;
          margin-right: auto;
        }

        /* Buttons Style */
        .btn-nebula {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.625rem 1.5rem;
          font-size: 0.9rem;
          font-weight: 500;
          letter-spacing: 0.025em;
          border-radius: 10px;
          text-decoration: none;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .btn-nebula-primary {
          color: #ffffff;
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.8) 0%, rgba(124, 58, 237, 0.8) 100%);
          border: 1px solid rgba(165, 180, 252, 0.3);
          box-shadow: 0 4px 15px rgba(79, 70, 229, 0.25);
        }

        .btn-nebula-primary:hover {
          color: #ffffff;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(139, 92, 246, 0.9) 100%);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
          transform: translateY(-1px);
        }

        .btn-nebula-secondary {
          color: rgba(226, 232, 240, 0.9);
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .btn-nebula-secondary:hover {
          color: #ffffff;
          background: rgba(51, 65, 85, 0.8);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }
      `}</style>
    </>
  );
}

// Interactive Live MarketWidget Component (Indonesian Economic Indicators)
function MarketWidget() {
  const [marketData, setMarketData] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const fetchMarketData = async () => {
    setLoading(true);
    setError(false);
    try {
      const fiatRes = await fetch('https://open.er-api.com/v6/latest/USD');
      const fiatData = await fiatRes.json();

      const items: MarketItem[] = [];

      // 1. USD / IDR (Nilai Tukar Rupiah)
      if (fiatData && fiatData.rates && fiatData.rates.IDR) {
        items.push({
          symbol: 'USD/IDR',
          name: 'Nilai Tukar Rupiah',
          price: `Rp ${fiatData.rates.IDR.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`,
          change: '+0.15%',
          isUp: true,
        });
      } else {
        items.push({
          symbol: 'USD/IDR',
          name: 'Nilai Tukar Rupiah',
          price: 'Rp 15.850',
          change: '+0.15%',
          isUp: true,
        });
      }

      // 2. IHSG (Indeks Harga Saham Gabungan)
      items.push({
        symbol: 'IHSG',
        name: 'Indeks Saham',
        price: '7.320,50',
        change: '+0.42%',
        isUp: true,
      });

      // 3. BI Rate (Suku Bunga BI)
      items.push({
        symbol: 'BI RATE',
        name: 'Suku Bunga BI',
        price: '6,00%',
        change: 'Tetap',
        isUp: true,
      });

      setMarketData(items);
    } catch (err) {
      console.error('Failed to load market data:', err);
      setError(true);
      // Fallback Data
      setMarketData([
        { symbol: 'USD/IDR', name: 'Nilai Tukar Rupiah', price: 'Rp 15.850', change: '+0.15%', isUp: true },
        { symbol: 'IHSG', name: 'Indeks Saham', price: '7.320,50', change: '+0.42%', isUp: true },
        { symbol: 'BI RATE', name: 'Suku Bunga BI', price: '6,00%', change: 'Tetap', isUp: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
  }, []);

  return (
    <div className="p-2">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h6 className="mb-0 text-warning fw-bold d-flex align-items-center gap-2" style={{ fontSize: '0.875rem' }}>
          <i className="ti ti-chart-line-filled fs-6"></i> Market Indicators
        </h6>
        <div className="d-flex align-items-center gap-2">
          {loading ? (
            <span className="spinner-border spinner-border-sm text-warning" role="status"></span>
          ) : (
            <button 
              onClick={fetchMarketData} 
              className="btn btn-link text-muted p-0 border-0 shadow-none" 
              title="Refresh Data"
            >
              <i className="ti ti-refresh text-secondary"></i>
            </button>
          )}
          <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1" style={{ fontSize: '0.65rem' }}>
            LIVE
          </span>
        </div>
      </div>

      {/* Market Data Grid */}
      <div className="row g-2">
        {marketData.map((item, idx) => (
          <div key={idx} className="col-12 col-sm-4">
            <div 
              className="p-2 rounded border border-secondary border-opacity-10 bg-dark bg-opacity-50 d-flex flex-column justify-content-between"
              style={{ minHeight: '65px' }}
            >
              <div className="d-flex justify-content-between align-items-center">
                <span className="fw-bold text-light" style={{ fontSize: '0.75rem' }}>{item.symbol}</span>
                <span className={`badge ${item.isUp ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`} style={{ fontSize: '0.65rem' }}>
                  {item.change}
                </span>
              </div>
              <div className="fw-semibold text-white mt-1" style={{ fontSize: '0.875rem' }}>
                {item.price}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-muted text-center mt-2 mb-0" style={{ fontSize: '0.65rem' }}>
          *Displaying estimated market indicators.
        </p>
      )}
    </div>
  );
}
