import React from 'react';
import { Scale, CheckCircle, AlertTriangle, AlertCircle, Download } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { calculateFinancialRatios, exportTableToExcel } from '../utils/accountingCalculations';

export const FinancialRatiosView: React.FC = () => {
  const { accounts, transactions, settings } = useAccounting();

  const ratios = calculateFinancialRatios(accounts, transactions);

  const handleExport = () => {
    const data: any[][] = [
      [`ANALISIS RASIO KEUANGAN - ${settings.companyName}`],
      [`Periode: ${settings.fiscalPeriod} (${settings.fiscalYear})`],
      [''],
      ['NAMA RASIO', 'KATEGORI', 'NILAI', 'SATUAN', 'STANDAR / BENCHMARK', 'STATUS', 'FORMULA', 'PENJELASAN']
    ];

    ratios.forEach(r => {
      data.push([
        r.name,
        r.category,
        r.value,
        r.unit,
        r.benchmark,
        r.status,
        r.formula,
        r.description
      ]);
    });

    exportTableToExcel(data, `Analisis_Rasio_${new Date().toISOString().split('T')[0]}`, 'Rasio Keuangan');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Good':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            <span>Sehat / Optimal</span>
          </span>
        );
      case 'Warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Waspada / Cukup</span>
          </span>
        );
      case 'Danger':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>Perlu Perbaikan</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <span>Netral</span>
          </span>
        );
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full animate-fadeIn">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284c7] shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900">Analisis Rasio Keuangan Perusahaan</h1>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-sky-50 text-[#0284c7] border border-sky-200 rounded-full">
                Indikator Finansial
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Indikator kesehatan finansial komprehensif mengukur likuiditas lancar, solvabilitas struktur modal, dan profitabilitas ekuitas PT Nirwana Bhumi Energi.
            </p>
          </div>
        </div>

        <button 
          onClick={handleExport} 
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Export Excel</span>
        </button>
      </div>

      {/* Ratio Cards Grid with High-Contrast Numbers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {ratios.map((r, idx) => (
          <div 
            key={idx} 
            className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between gap-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded-md">
                {r.category}
              </span>
              {getStatusBadge(r.status)}
            </div>

            <div>
              <div className="text-sm font-bold text-slate-900 mb-2">
                {r.name}
              </div>
              <div className="flex items-baseline gap-2 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                <span className="font-mono text-3xl font-black text-slate-950 tracking-tight">
                  {r.value}
                </span>
                <span className="text-sm font-black text-[#0284c7]">
                  {r.unit}
                </span>
              </div>
            </div>

            <div className="bg-slate-50/70 rounded-xl p-3 text-xs space-y-1.5 border border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Benchmark:</span>
                <span className="font-bold text-slate-800">{r.benchmark}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Formula:</span>
                <span className="font-mono text-[11px] font-semibold text-sky-700">{r.formula}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3 mt-auto">
              {r.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
