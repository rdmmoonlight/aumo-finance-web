'use client';

import { useEffect, useState } from 'react';
import styles from './MarketWidget.module.css';

interface MarketItem {
  price: number;
  percent: number;
  isUp: boolean;
}

interface MarketDataResponse {
  success: boolean;
  usd?: MarketItem;
  ihsg?: MarketItem;
  biRate?: string;
}

// Memory Cache Sederhana (mirip static variable di Blazor)
let cachedMarketData: MarketDataResponse | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 menit

export default function MarketWidget() {
  const [marketData, setMarketData] = useState<MarketDataResponse | null>(cachedMarketData);
  const [isLoading, setIsLoading] = useState<boolean>(!cachedMarketData);

  useEffect(() => {
    const now = Date.now();
    if (cachedMarketData && now - lastFetchTime < CACHE_DURATION_MS) {
      setMarketData(cachedMarketData);
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);
        // Sesuaikan endpoint API backend ASP.NET Core kamu
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/market-data`);
        if (!res.ok) throw new Error('Failed to fetch market data');

        const data: MarketDataResponse = await res.json();
        if (data && data.success) {
          cachedMarketData = data;
          lastFetchTime = Date.now();
          setMarketData(data);
        }
      } catch (ex) {
        console.error('[MarketWidget Error]', ex);
        if (cachedMarketData) {
          setMarketData(cachedMarketData);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const formatCurrency = (val?: number) =>
    val !== undefined
      ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
      : '0,00';

  const formatPercent = (val?: number) =>
    val !== undefined
      ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
      : '0,00';

  return (
    <div className={`${styles.marketCard} mx-auto mb-4 p-3 rounded-4`}>
      <div className={styles.cardGlassBg}></div>

      {isLoading ? (
        /* State: Loading Futuristic */
        <div className="d-flex justify-content-center align-items-center py-2 gap-2 text-secondary position-relative z-1">
          <div className={`spinner-border spinner-border-sm text-info ${styles.spinnerGlow}`} role="status"></div>
          <span className="small fw-medium style-loading-text text-light-50">Syncing live market data...</span>
        </div>
      ) : marketData && marketData.success ? (
        /* State: Success */
        <div className="row align-items-center g-3 text-center justify-content-center position-relative z-1">
          {/* USD / IDR */}
          <div className={`col-12 col-md-4 ${styles.borderEndFuturistic}`}>
            <div className="d-flex flex-column align-items-center justify-content-center px-1">
              <div className="d-flex align-items-center gap-1 mb-1">
                <span className={`${styles.indicatorDot} ${marketData.usd?.isUp ? styles.dotUp : styles.dotDown}`}></span>
                <span className={`${styles.styleLabel} text-uppercase`}>USD / IDR</span>
              </div>
              <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
                <span className={`fw-bold ${styles.styleValue} ${styles.textGlow} text-nowrap`}>
                  Rp. {formatCurrency(marketData.usd?.price)}
                </span>
                <span
                  className={`badge ${styles.badgeFuturistic} ${
                    marketData.usd?.isUp ? styles.badgeUp : styles.badgeDown
                  } text-nowrap`}
                >
                  <i className={`bi ${marketData.usd?.isUp ? 'bi-arrow-up-short' : 'bi-arrow-down-short'}`}></i>
                  {marketData.usd?.isUp ? '+' : ''}
                  {formatPercent(marketData.usd?.percent)}%
                </span>
              </div>
            </div>
          </div>

          {/* IHSG (IDX COMPOSITE) */}
          <div className={`col-12 col-md-4 ${styles.borderEndFuturistic}`}>
            <div className="d-flex flex-column align-items-center justify-content-center px-1">
              <div className="d-flex align-items-center gap-1 mb-1">
                <span className={`${styles.indicatorDot} ${marketData.ihsg?.isUp ? styles.dotUp : styles.dotDown}`}></span>
                <span className={`${styles.styleLabel} text-uppercase`}>IDX Composite</span>
              </div>
              <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
                <span className={`fw-bold ${styles.styleValue} ${styles.textGlow} text-nowrap`}>
                  {formatCurrency(marketData.ihsg?.price)}
                </span>
                <span
                  className={`badge ${styles.badgeFuturistic} ${
                    marketData.ihsg?.isUp ? styles.badgeUp : styles.badgeDown
                  } text-nowrap`}
                >
                  <i className={`bi ${marketData.ihsg?.isUp ? 'bi-arrow-up-short' : 'bi-arrow-down-short'}`}></i>
                  {marketData.ihsg?.isUp ? '+' : ''}
                  {formatPercent(marketData.ihsg?.percent)}%
                </span>
              </div>
            </div>
          </div>

          {/* BI-RATE */}
          <div className="col-12 col-md-4">
            <div className="d-flex flex-column align-items-center justify-content-center px-1">
              <div className="d-flex align-items-center gap-1 mb-1">
                <span className={`${styles.indicatorDot} ${styles.dotInfo}`}></span>
                <span className={`${styles.styleLabel} text-uppercase`}>BI-Rate</span>
              </div>
              <div className="d-flex align-items-center justify-content-center gap-2">
                <span className={`fw-bold ${styles.styleValue} ${styles.textInfoGlow} text-nowrap`}>
                  {marketData.biRate}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* State: Error / Fallback */
        <div className="d-flex align-items-center justify-content-center text-muted small py-1 gap-2 position-relative z-1">
          <i className="bi bi-exclamation-triangle text-warning"></i>
          <span className="style-loading-text">Market indicators temporarily offline.</span>
        </div>
      )}
    </div>
  );
}
