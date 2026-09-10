import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IconDashboard, IconNotebook, IconChartLine, IconRefresh, IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';
import apiClient from '@/services/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';


interface MarketItem { symbol: string; name: string; price: string; change: string; isUp: boolean; }

export default function HomePage() {
  return (
    <div className="min-h-screen w-full grid place-items-center p-4 bg-[#0B0F19] bg-[radial-gradient(circle_at_50%_30%,rgba(30,27,75,0.8),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(76,29,149,0.25),transparent_50%),radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.15),transparent_40%)]">
      <Card className="w-full max-w- bg-white/[0.06] backdrop-blur-xl border-white/10 shadow-2xl rounded-">
        <CardContent className="p-6 md:p-8">
          <MarketWidget />
          <div className="text-center mt-6">
            <p className="text- leading-relaxed text-white/80 max-w- mx-auto">
              Integrated financial & accounting intelligence core. Manage full-cycle general ledgers, trial balances, and operational analytics with absolute precision.
            </p>
            <div className="flex justify-center gap-3 mt-6 flex-wrap">
              <Button asChild className="rounded-xl bg-gradient-to-br from-indigo-500/80 to-violet-600/80 border border-indigo-300/20 shadow-lg hover:from-indigo-500 hover:to-violet-600"><Link to="/dashboard" className="flex items-center gap-2"><IconDashboard size={16}/> Dashboard</Link></Button>
              <Button asChild variant="secondary" className="rounded-xl bg-white/10 text-white hover:bg-white/15 border border-white/10"><Link to="/journal-entry" className="flex items-center gap-2"><IconNotebook size={16}/> General Journal</Link></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MarketWidget() {
  const [marketData, setMarketData] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      // pakai apiClient tapi URL eksternal tetap jalan
      const { data: fiatData } = await apiClient.get('https://open.er-api.com/v6/latest/USD');
      const items: MarketItem[] = [];
      if (fiatData?.rates?.IDR) {
        items.push({ symbol: 'USD/IDR', name: 'Rupiah', price: `Rp ${fiatData.rates.IDR.toLocaleString('id-ID',{maximumFractionDigits:0})}`, change: '+0.15%', isUp: true });
      } else {
        items.push({ symbol: 'USD/IDR', name: 'Rupiah', price: 'Rp 15.850', change: '+0.15%', isUp: true });
      }
      items.push({ symbol: 'IHSG', name: 'Indeks Saham', price: '7.320,50', change: '+0.42%', isUp: true });
      items.push({ symbol: 'BI RATE', name: 'Suku Bunga', price: '6,00%', change: 'Tetap', isUp: true });
      setMarketData(items);
    } catch {
      setMarketData([
        { symbol: 'USD/IDR', name: 'Rupiah', price: 'Rp 15.850', change: '+0.15%', isUp: true },
        { symbol: 'IHSG', name: 'Indeks Saham', price: '7.320,50', change: '+0.42%', isUp: true },
        { symbol: 'BI RATE', name: 'Suku Bunga', price: '6,00%', change: 'Tetap', isUp: true },
      ]);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ fetchMarketData(); }, []);

  return (
    <div className="rounded-xl bg-[#0F172A]/60 border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h6 className="text-sm font-bold flex items-center gap-2 text-amber-400"><IconChartLine size={16}/> Market Indicators</h6>
        <div className="flex items-center gap-2">
          {loading? <Skeleton className="h-4 w-4 rounded-full"/> : <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchMarketData}><IconRefresh size={14}/></Button>}
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-">LIVE</Badge>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {loading? [1,2,3].map(i=><Skeleton key={i} className="h- rounded-lg"/>) :
          marketData.map((item,idx)=>(
          <div key={idx} className="rounded-lg border border-white/10 bg-black/20 p-2.5 flex flex-col justify-between min-h-">
            <div className="flex justify-between items-center"><span className="text- font-bold text-white">{item.symbol}</span><Badge className={`text- ${item.isUp?'bg-emerald-500/15 text-emerald-400':'bg-red-500/15 text-red-400'} border-0`}>{item.isUp? <IconTrendingUp size={10} className="mr-0.5"/>:<IconTrendingDown size={10} className="mr-0.5"/>}{item.change}</Badge></div>
            <div className="text- font-semibold text-white mt-1">{item.price}</div>
            <div className="text- text-white/50">{item.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}