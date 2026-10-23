import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';

export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
];

interface MonthYearPickerProps {
  value: string; // e.g., "Oktober 2026" or "Oktober"
  yearValue?: number; // e.g., 2026
  onChange: (period: string, year: number) => void;
  label?: string;
  className?: string;
}

export const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  value,
  yearValue,
  onChange,
  label,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial month and year from props
  const parsePeriod = (): { monthIndex: number; year: number } => {
    const currentYear = new Date().getFullYear();
    let y = yearValue || currentYear;
    let mIdx = 9; // Default: Oktober (index 9)

    if (value) {
      // Find year if in string (e.g. 2026)
      const yearMatch = value.match(/\b(20\d\d)\b/);
      if (yearMatch) {
        y = parseInt(yearMatch[1], 10);
      }

      // Find month name
      const foundIdx = MONTH_NAMES_ID.findIndex(m => 
        value.toLowerCase().includes(m.toLowerCase())
      );
      if (foundIdx !== -1) {
        mIdx = foundIdx;
      }
    }

    return { monthIndex: mIdx, year: y };
  };

  const initial = parsePeriod();
  const [selectedMonth, setSelectedMonth] = useState<number>(initial.monthIndex);
  const [selectedYear, setSelectedYear] = useState<number>(initial.year);

  // Sync internal state if prop changes externally
  useEffect(() => {
    const parsed = parsePeriod();
    setSelectedMonth(parsed.monthIndex);
    setSelectedYear(parsed.year);
  }, [value, yearValue]);

  // Handle outside click to close popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectMonth = (monthIdx: number) => {
    setSelectedMonth(monthIdx);
    const monthName = MONTH_NAMES_ID[monthIdx];
    const periodString = `${monthName} ${selectedYear}`;
    onChange(periodString, selectedYear);
    setIsOpen(false);
  };

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
    const monthName = MONTH_NAMES_ID[selectedMonth];
    const periodString = `${monthName} ${newYear}`;
    onChange(periodString, newYear);
  };

  const handleSetCurrent = () => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    setSelectedMonth(curMonth);
    setSelectedYear(curYear);
    onChange(`${MONTH_NAMES_ID[curMonth]} ${curYear}`, curYear);
    setIsOpen(false);
  };

  const displayText = `${MONTH_NAMES_ID[selectedMonth]} ${selectedYear}`;

  // Years range for dropdown selector (2020 to 2035)
  const yearsList = Array.from({ length: 16 }, (_, i) => 2020 + i);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block font-semibold text-slate-700 text-xs mb-1.5 flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[10px] text-sky-600 font-medium">Bulan &amp; Tahun (Tanpa Tanggal)</span>
        </label>
      )}

      {/* Trigger Button - Looks like a premium input field */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white border border-slate-300 hover:border-sky-500 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
        title="Klik untuk memilih Bulan & Tahun pembukuan"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284c7]">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <span className="text-slate-900 font-bold text-xs">{displayText}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-sky-600' : ''}`} />
      </button>

      {/* Calendar Month & Year Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 animate-fadeIn">
          
          {/* Header: Year Controls */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <button
              type="button"
              onClick={() => handleYearChange(selectedYear - 1)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Tahun Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Tahun Buku:</span>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="font-bold text-sm text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {yearsList.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleYearChange(selectedYear + 1)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Tahun Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Month Selection Grid: 3x4 */}
          <div className="grid grid-cols-3 gap-2 py-3">
            {MONTH_NAMES_ID.map((m, idx) => {
              const isSelected = selectedMonth === idx;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectMonth(idx)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0284c7] text-white shadow-xs font-bold'
                      : 'text-slate-700 hover:bg-sky-50 hover:text-[#0284c7]'
                  }`}
                >
                  <span>{m.substring(0, 3)}</span>
                  {isSelected && <Check className="w-3 h-3 text-white shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Action */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleSetCurrent}
              className="text-sky-600 hover:text-sky-800 font-semibold cursor-pointer py-1 px-2 rounded hover:bg-sky-50"
            >
              Pilih Bulan Ini
            </button>
            <span className="text-slate-400">
              Format: {MONTH_NAMES_ID[selectedMonth]} {selectedYear}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
