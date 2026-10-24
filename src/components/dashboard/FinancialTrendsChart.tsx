import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Eye, 
  EyeOff, 
  Calendar, 
  Check, 
  HelpCircle,
  Maximize2
} from 'lucide-react';
import { Account, Transaction } from '../../types/accounting';
import { 
  formatRupiah, 
  calculateBalanceSheet, 
  calculateProfitAndLoss, 
  calculateAccountBalance 
} from '../../utils/accountingCalculations';

export type TimePeriod = 'month' | 'year';

export interface FinancialMetricLine {
  id: string;
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
  borderColor: string;
  category: string;
}

export const FINANCIAL_METRIC_CONFIG: FinancialMetricLine[] = [
  {
    id: 'kas',
    name: 'Saldo Kas Utama',
    shortName: 'Kas Utama',
    color: '#059669', // Emerald 600
    bgColor: 'bg-emerald-50 text-emerald-700',
    borderColor: 'border-emerald-300',
    category: 'Kas & Bank'
  },
  {
    id: 'aset',
    name: 'Total Aset (Harta)',
    shortName: 'Total Aset',
    color: '#d97706', // Amber 600
    bgColor: 'bg-amber-50 text-amber-700',
    borderColor: 'border-amber-300',
    category: 'Harta Lancar & Tetap'
  },
  {
    id: 'kewajibanEkuitas',
    name: 'Kewajiban & Ekuitas',
    shortName: 'Kewajiban & Ekuitas',
    color: '#0284c7', // Sky 600
    bgColor: 'bg-sky-50 text-sky-700',
    borderColor: 'border-sky-300',
    category: 'Utang & Modal'
  },
  {
    id: 'pendapatan',
    name: 'Total Pendapatan',
    shortName: 'Pendapatan',
    color: '#0891b2', // Cyan 600
    bgColor: 'bg-cyan-50 text-cyan-700',
    borderColor: 'border-cyan-300',
    category: 'Laba Rugi'
  },
  {
    id: 'beban',
    name: 'Total Beban',
    shortName: 'Beban',
    color: '#e11d48', // Rose 600
    bgColor: 'bg-rose-50 text-rose-700',
    borderColor: 'border-rose-300',
    category: 'Beban Berjalan'
  }
];

interface FinancialTrendsChartProps {
  accounts: Account[];
  transactions: Transaction[];
  currentPeriodName?: string;
  embedded?: boolean;
}

interface DataPoint {
  label: string;
  fullDate: string;
  kas: number;
  aset: number;
  kewajibanEkuitas: number;
  pendapatan: number;
  beban: number;
}

export const FinancialTrendsChart: React.FC<FinancialTrendsChartProps> = ({
  accounts,
  transactions,
  currentPeriodName = 'Periode Berjalan',
  embedded = false
}) => {
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
    kas: true,
    aset: true,
    kewajibanEkuitas: true,
    pendapatan: true,
    beban: true
  });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Toggle individual line visibility
  const toggleLine = (id: string) => {
    setVisibleLines(prev => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      // Do not disable the last visible line to prevent empty graph
      if (prev[id] && activeCount === 1) {
        return prev;
      }
      return { ...prev, [id]: !prev[id] };
    });
  };

  // Toggle all lines on or off
  const toggleAllLines = (select: boolean) => {
    setVisibleLines({
      kas: select,
      aset: select,
      kewajibanEkuitas: select,
      pendapatan: select,
      beban: select
    });
  };

  // Find primary Kas account
  const kasAccount = useMemo(() => {
    return accounts.find(a => a.code === '10001') ||
           accounts.find(a => !a.isHeader && a.category === 'HARTA_LANCAR' && a.name.toLowerCase().includes('kas')) ||
           accounts.find(a => a.category === 'HARTA_LANCAR');
  }, [accounts]);

  // Compute time-series data points
  const dataPoints: DataPoint[] = useMemo(() => {
    // Determine active year and month based on transactions or current date
    let refYear = 2026;
    let refMonth = 10; // October
    if (transactions.length > 0) {
      const dates = transactions.map(t => new Date(t.date)).filter(d => !isNaN(d.getTime()));
      if (dates.length > 0) {
        const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
        refYear = latestDate.getFullYear();
        refMonth = latestDate.getMonth() + 1;
      }
    }

    if (period === 'month') {
      // 30 days of the month
      const points: DataPoint[] = [];
      const daysCount = 30;

      for (let day = 1; day <= daysCount; day++) {
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(refMonth).padStart(2, '0');
        const dateLimit = `${refYear}-${monthStr}-${dayStr}`;

        // Filter transactions up to this date
        const subTrx = transactions.filter(t => t.date <= dateLimit);

        // Kas balance up to date
        const kasBalance = kasAccount ? calculateAccountBalance(kasAccount, subTrx).endingBalance : 0;
        
        // Balance sheet up to date
        const bs = calculateBalanceSheet(accounts, subTrx);
        
        // Profit and loss up to date
        const pl = calculateProfitAndLoss(accounts, subTrx);
        const revenue = pl.totalOperasionalRevenue + pl.totalNonOperasionalRevenue;
        const expense = pl.totalOperasionalExpense + pl.totalNonOperasionalExpense;

        points.push({
          label: `${day}`,
          fullDate: `Tgl ${day} ${new Date(refYear, refMonth - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`,
          kas: kasBalance,
          aset: bs.totalAssets,
          kewajibanEkuitas: bs.totalLiabilitiesAndEquity,
          pendapatan: revenue,
          beban: expense
        });
      }
      return points;
    } else {
      // 12 months of the year
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
      const points: DataPoint[] = [];

      for (let m = 1; m <= 12; m++) {
        const lastDay = new Date(refYear, m, 0).getDate();
        const monthStr = String(m).padStart(2, '0');
        const dateLimit = `${refYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        const subTrx = transactions.filter(t => t.date <= dateLimit);
        const kasBalance = kasAccount ? calculateAccountBalance(kasAccount, subTrx).endingBalance : 0;
        const bs = calculateBalanceSheet(accounts, subTrx);
        const pl = calculateProfitAndLoss(accounts, subTrx);
        const revenue = pl.totalOperasionalRevenue + pl.totalNonOperasionalRevenue;
        const expense = pl.totalOperasionalExpense + pl.totalNonOperasionalExpense;

        points.push({
          label: monthNames[m - 1],
          fullDate: `${monthNames[m - 1]} ${refYear}`,
          kas: kasBalance,
          aset: bs.totalAssets,
          kewajibanEkuitas: bs.totalLiabilitiesAndEquity,
          pendapatan: revenue,
          beban: expense
        });
      }
      return points;
    }
  }, [accounts, transactions, period, kasAccount]);

  // Current latest values for each metric
  const latestValues = useMemo(() => {
    if (dataPoints.length === 0) {
      return { kas: 0, aset: 0, kewajibanEkuitas: 0, pendapatan: 0, beban: 0 };
    }
    const last = dataPoints[dataPoints.length - 1];
    return {
      kas: last.kas,
      aset: last.aset,
      kewajibanEkuitas: last.kewajibanEkuitas,
      pendapatan: last.pendapatan,
      beban: last.beban
    };
  }, [dataPoints]);

  // Y-axis scaling calculation based ONLY on visible lines
  const { minY, maxY, yTicks, zeroY } = useMemo(() => {
    const activeValues: number[] = [];

    dataPoints.forEach(p => {
      if (visibleLines.kas) activeValues.push(p.kas);
      if (visibleLines.aset) activeValues.push(p.aset);
      if (visibleLines.kewajibanEkuitas) activeValues.push(p.kewajibanEkuitas);
      if (visibleLines.pendapatan) activeValues.push(p.pendapatan);
      if (visibleLines.beban) activeValues.push(p.beban);
    });

    if (activeValues.length === 0) {
      return { minY: -1000000, maxY: 1000000, yTicks: [-1000000, 0, 1000000], zeroY: 0 };
    }

    let rawMin = Math.min(...activeValues);
    let rawMax = Math.max(...activeValues);

    // If all values are identical or zero
    if (rawMin === rawMax) {
      if (rawMin === 0) {
        rawMin = -1000000;
        rawMax = 1000000;
      } else if (rawMin > 0) {
        rawMin = 0;
        rawMax = rawMax * 1.35;
      } else {
        rawMin = rawMin * 1.35;
        rawMax = 0;
      }
    } else {
      // Add generous headroom above and padding below so no line hits the boundary
      const span = rawMax - rawMin;
      const pad = Math.max(span * 0.15, 200000);
      rawMax += pad;
      rawMin -= pad;
    }

    // Determine clean step increments
    const totalSpan = rawMax - rawMin;
    const targetTicks = 5;
    const roughStep = totalSpan / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const residual = roughStep / magnitude;

    let step = magnitude;
    if (residual < 1.5) step = 1 * magnitude;
    else if (residual < 3) step = 2 * magnitude;
    else if (residual < 7) step = 5 * magnitude;
    else step = 10 * magnitude;

    const computedMin = Math.floor(rawMin / step) * step;
    const computedMax = Math.ceil(rawMax / step) * step;

    const ticks: number[] = [];
    for (let val = computedMin; val <= computedMax + (step * 0.5); val += step) {
      ticks.push(Math.round(val));
    }

    return {
      minY: computedMin,
      maxY: computedMax,
      yTicks: ticks,
      zeroY: computedMin <= 0 && computedMax >= 0 ? 0 : null
    };
  }, [dataPoints, visibleLines]);

  // SVG coordinate dimensions
  const svgWidth = 980;
  const svgHeight = 490;
  const paddingLeft = 88;
  const paddingRight = 130; // Space for right-edge value callout tags
  const paddingTop = 36;
  const paddingBottom = 46;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Coordinate mapping functions
  const getX = (index: number) => {
    if (dataPoints.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (dataPoints.length - 1)) * chartWidth;
  };

  const getY = (value: number) => {
    if (maxY === minY) return paddingTop + chartHeight / 2;
    const ratio = (value - minY) / (maxY - minY);
    // SVG Y is inverted (0 is top)
    return paddingTop + chartHeight - ratio * chartHeight;
  };

  // Build SVG path for a specific metric
  const getLinePath = (metricKey: 'kas' | 'aset' | 'kewajibanEkuitas' | 'pendapatan' | 'beban') => {
    if (dataPoints.length === 0) return '';
    return dataPoints.reduce((acc, point, idx) => {
      const x = getX(idx);
      const y = getY(point[metricKey]);
      if (idx === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      // Smooth cubic curve between points
      const prevX = getX(idx - 1);
      const prevY = getY(dataPoints[idx - 1][metricKey]);
      const cpX1 = prevX + (x - prevX) / 2;
      const cpX2 = prevX + (x - prevX) / 2;
      return `${acc} C ${cpX1.toFixed(1)} ${prevY.toFixed(1)}, ${cpX2.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  };

  // Format currency for Y-axis tick labels
  const formatTickCurrency = (val: number) => {
    const isNeg = val < 0;
    const absVal = Math.abs(val);
    let str = '0';
    if (absVal >= 1_000_000_000) {
      str = `${(absVal / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
    } else if (absVal >= 1_000_000) {
      str = `${(absVal / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
    } else if (absVal >= 1_000) {
      str = `${(absVal / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
    } else if (absVal > 0) {
      str = `${absVal}`;
    }
    return isNeg ? `-Rp ${str}` : `Rp ${str}`;
  };

  // Active hover data point
  const activeHoverPoint = hoverIndex !== null && dataPoints[hoverIndex] ? dataPoints[hoverIndex] : null;

  return (
    <div className={`transition-all duration-200 h-full flex flex-col justify-between ${
      embedded ? 'w-full' : 'bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 md:p-6'
    }`}>
      
      {/* 1. Header (Simple & Minimalist matching Reference Mockup) */}
      <div className="pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg border border-sky-100">
            <TrendingUp className="w-4 h-4" />
          </span>
          <h2 className="text-sm md:text-base font-bold text-slate-800 tracking-tight">
            Tren Dinamika 5 Pilar Keuangan
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Visualisasi fluktuasi Saldo Kas, Total Aset, Kewajiban & Ekuitas, Pendapatan, dan Beban ({currentPeriodName}).
        </p>
      </div>

      {/* 3. SVG Financial Chart Canvas */}
      <div className="relative mt-2 w-full overflow-hidden select-none bg-slate-50/50 rounded-xl border border-slate-100 p-1 flex-1 flex flex-col justify-center min-h-[390px]">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) * (svgWidth / rect.width);
            const clampedX = Math.max(paddingLeft, Math.min(paddingLeft + chartWidth, relX));
            const ratio = (clampedX - paddingLeft) / chartWidth;
            const index = Math.round(ratio * (dataPoints.length - 1));
            setHoverIndex(Math.max(0, Math.min(dataPoints.length - 1, index)));
          }}
        >
          {/* Subtle Background Grid Lines & Y-Axis Labels */}
          {yTicks.map((tickVal, i) => {
            const y = getY(tickVal);
            const isZero = tickVal === 0;

            return (
              <g key={`ytick-${i}`}>
                {/* Horizontal grid line */}
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + chartWidth}
                  y2={y}
                  stroke={isZero ? '#94a3b8' : '#e2e8f0'}
                  strokeWidth={isZero ? 1.5 : 1}
                  strokeDasharray={isZero ? '4 3' : '2 3'}
                />
                {/* Y-Axis tick label */}
                <text
                  x={paddingLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fontFamily="monospace"
                  fill={isZero ? '#0f172a' : '#64748b'}
                  fontWeight={isZero ? 'bold' : 'normal'}
                >
                  {formatTickCurrency(tickVal)}
                </text>
              </g>
            );
          })}

          {/* Zero baseline indicator if visible */}
          {zeroY !== null && (
            <g>
              <line
                x1={paddingLeft}
                y1={getY(0)}
                x2={paddingLeft + chartWidth}
                y2={getY(0)}
                stroke="#64748b"
                strokeWidth={1.5}
              />
              <text
                x={paddingLeft - 10}
                y={getY(0) + 3.5}
                textAnchor="end"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
                fill="#0f172a"
              >
                Rp 0
              </text>
            </g>
          )}

          {/* X-Axis Vertical Ticks & Date Labels */}
          {dataPoints.map((point, idx) => {
            // Decide tick label frequency to avoid overcrowding
            let showLabel = false;
            if (period === 'month') {
              // Show label on day 1, 5, 10, 15, 20, 25, 30
              const dayNum = idx + 1;
              showLabel = dayNum === 1 || dayNum % 5 === 0 || dayNum === dataPoints.length;
            } else {
              // 12 months: show all 12
              showLabel = true;
            }

            if (!showLabel) return null;

            const x = getX(idx);
            const yBottom = paddingTop + chartHeight;

            return (
              <g key={`xtick-${idx}`}>
                <line
                  x1={x}
                  y1={yBottom}
                  x2={x}
                  y2={yBottom + 5}
                  stroke="#cbd5e1"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={yBottom + 18}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#475569"
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  {period === 'month' ? `Tgl ${point.label}` : point.label}
                </text>
              </g>
            );
          })}

          {/* 4. The 5 Financial Metric Lines */}
          {visibleLines.kas && (
            <path
              d={getLinePath('kas')}
              fill="none"
              stroke="#059669"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {visibleLines.aset && (
            <path
              d={getLinePath('aset')}
              fill="none"
              stroke="#d97706"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {visibleLines.kewajibanEkuitas && (
            <path
              d={getLinePath('kewajibanEkuitas')}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {visibleLines.pendapatan && (
            <path
              d={getLinePath('pendapatan')}
              fill="none"
              stroke="#0891b2"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {visibleLines.beban && (
            <path
              d={getLinePath('beban')}
              fill="none"
              stroke="#e11d48"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 5. End-Point Value Badges on the Right Edge (similar to Image 2 reference) */}
          {(() => {
            const lastIdx = dataPoints.length - 1;
            if (lastIdx < 0) return null;
            const endX = getX(lastIdx);

            const activeConfigs = FINANCIAL_METRIC_CONFIG.filter(c => visibleLines[c.id]);
            // Sort by end Y position to prevent overlap
            const badgeItems = activeConfigs.map(c => {
              const val = latestValues[c.id as keyof typeof latestValues] || 0;
              const rawY = getY(val);
              return { ...c, val, rawY, resolvedY: rawY };
            }).sort((a, b) => a.rawY - b.rawY);

            // Separate overlapping labels (minimum 18px distance)
            for (let i = 1; i < badgeItems.length; i++) {
              if (badgeItems[i].resolvedY - badgeItems[i - 1].resolvedY < 18) {
                badgeItems[i].resolvedY = badgeItems[i - 1].resolvedY + 18;
              }
            }

            return badgeItems.map(item => (
              <g key={`end-badge-${item.id}`}>
                {/* Connecting small point */}
                <circle
                  cx={endX}
                  cy={item.rawY}
                  r="3.5"
                  fill={item.color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                {/* Connecting subtle line if resolvedY was shifted */}
                {Math.abs(item.resolvedY - item.rawY) > 2 && (
                  <line
                    x1={endX}
                    y1={item.rawY}
                    x2={endX + 8}
                    y2={item.resolvedY}
                    stroke={item.color}
                    strokeWidth="0.75"
                    strokeDasharray="2 2"
                  />
                )}
                {/* Callout value badge text */}
                <text
                  x={endX + 10}
                  y={item.resolvedY + 3.5}
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill={item.color}
                >
                  {formatTickCurrency(item.val)}
                </text>
              </g>
            ));
          })()}

          {/* 6. Interactive Hover Crosshair & Data Inspection */}
          {hoverIndex !== null && dataPoints[hoverIndex] && (
            <g>
              {/* Vertical Guide Line */}
              <line
                x1={getX(hoverIndex)}
                y1={paddingTop}
                x2={getX(hoverIndex)}
                y2={paddingTop + chartHeight}
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />

              {/* Data Point Circles on Active Lines */}
              {visibleLines.kas && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(dataPoints[hoverIndex].kas)}
                  r="5"
                  fill="#059669"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
              {visibleLines.aset && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(dataPoints[hoverIndex].aset)}
                  r="5"
                  fill="#d97706"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
              {visibleLines.kewajibanEkuitas && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(dataPoints[hoverIndex].kewajibanEkuitas)}
                  r="5"
                  fill="#0284c7"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
              {visibleLines.pendapatan && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(dataPoints[hoverIndex].pendapatan)}
                  r="5"
                  fill="#0891b2"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
              {visibleLines.beban && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(dataPoints[hoverIndex].beban)}
                  r="5"
                  fill="#e11d48"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
            </g>
          )}
        </svg>

        {/* 7. Floating Hover Detail Card */}
        {activeHoverPoint && hoverIndex !== null && (
          <div
            className="absolute top-4 pointer-events-none z-10 bg-slate-900/95 text-white p-3 rounded-xl shadow-lg border border-slate-700/80 backdrop-blur-xs text-xs space-y-1.5 transition-all duration-75"
            style={{
              left: `${Math.min(
                Math.max((getX(hoverIndex) / svgWidth) * 100, 15),
                70
              )}%`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 flex items-center justify-between gap-4">
              <span>{activeHoverPoint.fullDate}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {period === 'month' ? `Hari ke-${hoverIndex + 1}` : `Bulan ke-${hoverIndex + 1}`}
              </span>
            </div>

            <div className="space-y-1 pt-0.5">
              {visibleLines.kas && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Kas Utama:
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatRupiah(activeHoverPoint.kas)}
                  </span>
                </div>
              )}
              {visibleLines.aset && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Total Aset:
                  </span>
                  <span className="font-mono font-bold text-amber-400">
                    {formatRupiah(activeHoverPoint.aset)}
                  </span>
                </div>
              )}
              {visibleLines.kewajibanEkuitas && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    Kewajiban & Ekuitas:
                  </span>
                  <span className="font-mono font-bold text-sky-400">
                    {formatRupiah(activeHoverPoint.kewajibanEkuitas)}
                  </span>
                </div>
              )}
              {visibleLines.pendapatan && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    Pendapatan:
                  </span>
                  <span className="font-mono font-bold text-cyan-400">
                    {formatRupiah(activeHoverPoint.pendapatan)}
                  </span>
                </div>
              )}
              {visibleLines.beban && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Total Beban:
                  </span>
                  <span className="font-mono font-bold text-rose-400">
                    {formatRupiah(activeHoverPoint.beban)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Footer Info & Metric Interpretation */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-500">
        <div>
          <span>
            Skala vertikal (Y) otomatis beradaptasi dengan nilai nominal tertinggi & terendah (termasuk nilai minus).
          </span>
        </div>
        <div className="text-slate-400">
          Arahkan kursor atau sentuh grafik untuk memeriksa rincian nilai pada tanggal tertentu.
        </div>
      </div>

      {/* 5. Interactive Line Selection Chips (Positioned underneath chart per Reference Mockup) */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
        {FINANCIAL_METRIC_CONFIG.map(metric => {
          const isSelected = !!visibleLines[metric.id];
          const val = latestValues[metric.id as keyof typeof latestValues] || 0;

          return (
            <button
              key={metric.id}
              type="button"
              role="switch"
              aria-checked={isSelected}
              onClick={() => toggleLine(metric.id)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                isSelected
                  ? `${metric.bgColor} ${metric.borderColor} shadow-2xs`
                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
              }`}
              title={`Klik untuk menyembunyikan atau menampilkan garis ${metric.name}`}
            >
              <span 
                className="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
                style={{ backgroundColor: isSelected ? metric.color : '#94a3b8' }}
              />
              <span className={`font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-500 line-through'}`}>
                {metric.shortName}
              </span>
              <span className={`font-mono text-[11px] ml-0.5 px-1.5 py-0.2 rounded font-bold ${
                isSelected ? 'bg-white/80 text-slate-800 border border-slate-200/50' : 'text-slate-400'
              }`}>
                {formatTickCurrency(val)}
              </span>
              {isSelected ? (
                <Eye className="w-3 h-3 text-slate-400 ml-0.5" />
              ) : (
                <EyeOff className="w-3 h-3 text-slate-400 ml-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* 6. Bottom Right Time Period Filter (1 Bulan / 1 Tahun & Quick Select) */}
      <div className="mt-3 pt-2 flex flex-wrap items-center justify-end gap-2">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              period === 'month'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
            <span>1 Bulan (30 Hari)</span>
          </button>
          <button
            type="button"
            onClick={() => setPeriod('year')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              period === 'year'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>1 Tahun (12 Bulan)</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => toggleAllLines(true)}
          className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg border border-slate-200 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          title="Tampilkan kelima garis keuangan"
        >
          Pilih Semua (5)
        </button>
      </div>

    </div>
  );
};
