import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Save, 
  Download, 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  FileSpreadsheet, 
  ShieldAlert,
  Award
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { CompanySettings, TrialBalanceItem } from '../types/accounting';
import { 
  calculateGeneralLedgers, 
  calculateBalanceSheet, 
  calculateProfitAndLoss, 
  calculateWorksheet,
  calculateTrialBalance,
  exportTableToExcel 
} from '../utils/accountingCalculations';
import { PwaInstallBanner } from '../components/common/PwaInstallBanner';
import * as XLSX from 'xlsx';

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    accounts, 
    transactions, 
    exportDatabaseJson, 
    importDatabaseJson
  } = useAccounting();

  const [formData, setFormData] = useState<CompanySettings>(() => ({
    ...settings,
    directorName: settings.directorName || settings.approverName || 'Sudono Salim',
    directorTitle: settings.directorTitle || settings.approverTitle || 'Direktur Utama',
    accountantName: settings.accountantName || settings.preparerName || 'Mazmur Gusti Agung L',
    accountantTitle: settings.accountantTitle || settings.preparerTitle || 'Direktur Keuangan',
  }));

  useEffect(() => {
    setFormData({
      ...settings,
      directorName: settings.directorName || settings.approverName || 'Sudono Salim',
      directorTitle: settings.directorTitle || settings.approverTitle || 'Direktur Utama',
      accountantName: settings.accountantName || settings.preparerName || 'Mazmur Gusti Agung L',
      accountantTitle: settings.accountantTitle || settings.preparerTitle || 'Direktur Keuangan',
    });
  }, [settings]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (field: keyof CompanySettings, val: any) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CompanySettings = {
      ...formData,
      directorName: formData.directorName || 'Sudono Salim',
      directorTitle: formData.directorTitle || 'Direktur Utama',
      approverName: formData.directorName || 'Sudono Salim',
      approverTitle: formData.directorTitle || 'Direktur Utama',
      accountantName: formData.accountantName || 'Mazmur Gusti Agung L',
      accountantTitle: formData.accountantTitle || 'Direktur Keuangan',
      preparerName: formData.accountantName || 'Mazmur Gusti Agung L',
      preparerTitle: formData.accountantTitle || 'Direktur Keuangan',
    };
    updateSettings(payload);
    setSuccessMsg('Profil entitas & nama/jabatan pejabat penandatangan berhasil disimpan dan disinkronkan ke seluruh laporan.');
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportDatabaseJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPECTRA_Backup_${formData.companyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importDatabaseJson(content);
      if (res.success) {
        setSuccessMsg(res.message);
        setFormData({ ...settings });
      } else {
        setErrorMsg(res.message);
      }
      setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 5000);
    };
    reader.readAsText(file);
  };

  const handleExportFullWorkbook = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: COA
    const coaData: any[][] = [
      ['KODE', 'NAMA AKUN', 'KELOMPOK', 'POS', 'SN', 'DEBET AWAL', 'KREDIT AWAL']
    ];
    accounts.forEach(a => {
      coaData.push([a.code, a.name, a.categoryName, a.pos, a.sn, a.debetAwal, a.kreditAwal]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(coaData), 'Daftar Akun');

    // Sheet 2: Jurnal Umum
    const juData: any[][] = [
      ['TANGGAL', 'REF', 'TIPE', 'KETERANGAN', 'KODE AKUN', 'NAMA AKUN', 'DEBET', 'KREDIT']
    ];
    transactions.forEach(trx => {
      trx.lines.forEach((l, idx) => {
        juData.push([
          idx === 0 ? trx.date : '',
          idx === 0 ? trx.refNumber : '',
          idx === 0 ? (trx.type || 'general') : '',
          idx === 0 ? trx.description : (l.memo || ''),
          l.accountCode,
          l.accountName,
          l.debit,
          l.credit
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(juData), 'Jurnal Umum');

    // Sheet 3: Neraca Saldo
    const tb = calculateTrialBalance(accounts, transactions);
    const tbData: any[][] = [
      ['KODE', 'NAMA AKUN', 'DEBET', 'KREDIT']
    ];
    tb.forEach((r: TrialBalanceItem) => {
      tbData.push([r.code, r.name, r.debit, r.credit]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tbData), 'Neraca Saldo');

    // Sheet 4: Laba Rugi
    const pl = calculateProfitAndLoss(accounts, transactions);
    const plData: any[][] = [
      ['KATEGORI', 'KODE', 'NAMA AKUN', 'NOMINAL'],
      ['PENDAPATAN', '', '', pl.totalRevenues],
      ['HPP', '', '', pl.totalCOGS],
      ['LABA KOTOR', '', '', pl.grossProfit],
      ['BEBAN OPERASIONAL', '', '', pl.totalOperatingExpenses],
      ['LABA BERSIH', '', '', pl.netIncome]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(plData), 'Laba Rugi');

    XLSX.writeFile(wb, `SPECTRA_${formData.companyName.replace(/\s+/g, '_')}_Komprehensif.xlsx`);
  };

  return (
    <div className="p-5 space-y-6 max-w-5xl mx-auto pb-16 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
        <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <span>Pengaturan Perusahaan & Manajemen Data</span>
        </h2>
        <p className="text-xs text-slate-500">
          Konfigurasi identitas entitas bisnis, pencadangan dan pemulihan basis data, serta otorisasi keamanan.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-800 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Profil Perusahaan Form */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          <span>1. Profil Identitas Perusahaan / Entitas</span>
        </h3>

        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Perusahaan / PT</label>
            <input 
              type="text" 
              required
              value={formData.companyName}
              onChange={e => handleChange('companyName', e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Periode Pembukuan</label>
            <input 
              type="text" 
              required
              value={formData.fiscalPeriod}
              onChange={e => handleChange('fiscalPeriod', e.target.value)}
              placeholder="Desember 2021"
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Bidang Usaha</label>
            <input 
              type="text" 
              value={formData.businessType}
              onChange={e => handleChange('businessType', e.target.value)}
              placeholder="Perdagangan & Jasa"
              className="w-full border border-slate-300 rounded px-2.5 py-1.5"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mata Uang</label>
            <input 
              type="text" 
              value={formData.currency}
              onChange={e => handleChange('currency', e.target.value)}
              placeholder="IDR (Rp)"
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Alamat Kantor / Perusahaan</label>
            <input 
              type="text" 
              value={formData.address}
              onChange={e => handleChange('address', e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5"
            />
          </div>

          {/* Pejabat Penandatangan Laporan Keuangan */}
          <div className="md:col-span-2 pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  Pejabat Penandatangan Laporan Keuangan (Otorisasi & Tanda Tangan)
                </span>
              </div>
              <span className="text-[11px] text-slate-500 italic">
                Otomatis tampil pada seluruh lembar laporan (PSAK, Neraca, Laba Rugi, dll.)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
              
              {/* Box 1: Pihak Penyiap (Prepared By) */}
              <div className="space-y-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="font-bold text-[11px] text-indigo-900 uppercase tracking-wide">
                    1. Disiapkan oleh (Prepared by)
                  </span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold border border-indigo-100">
                    Penyiap Lap.
                  </span>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Nama Pejabat Penyiap
                  </label>
                  <input 
                    type="text" 
                    value={formData.accountantName || formData.preparerName || ''}
                    placeholder="Contoh: Mazmur Gusti Agung L"
                    onChange={e => {
                      handleChange('accountantName', e.target.value);
                      handleChange('preparerName', e.target.value);
                    }}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Jabatan Pejabat Penyiap
                  </label>
                  <input 
                    type="text" 
                    value={formData.accountantTitle || formData.preparerTitle || ''}
                    placeholder="Contoh: Direktur Keuangan / CFO"
                    onChange={e => {
                      handleChange('accountantTitle', e.target.value);
                      handleChange('preparerTitle', e.target.value);
                    }}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Box 2: Pihak Penyetuju (Approved By) */}
              <div className="space-y-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="font-bold text-[11px] text-emerald-900 uppercase tracking-wide">
                    2. Disetujui oleh (Approved by)
                  </span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold border border-emerald-100">
                    Pimpinan / Direktur
                  </span>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Nama Direktur / Penyetuju
                  </label>
                  <input 
                    type="text" 
                    value={formData.directorName || formData.approverName || ''}
                    placeholder="Contoh: Budi Santoso / Sudono Salim"
                    onChange={e => {
                      handleChange('directorName', e.target.value);
                      handleChange('approverName', e.target.value);
                    }}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Jabatan Direktur / Penyetuju
                  </label>
                  <input 
                    type="text" 
                    value={formData.directorTitle || formData.approverTitle || ''}
                    placeholder="Contoh: Direktur Utama / President Director"
                    onChange={e => {
                      handleChange('directorTitle', e.target.value);
                      handleChange('approverTitle', e.target.value);
                    }}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

            </div>

            {/* Live Preview Box */}
            <div className="mt-2 p-3 bg-slate-100/80 rounded-lg border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
                Preview Format Tanda Tangan pada Dokumen Laporan Keuangan
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-2.5 bg-white rounded border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">Disiapkan oleh / Prepared by:</div>
                  <div className="font-bold text-xs text-slate-900 underline mt-4">
                    {formData.accountantName || formData.preparerName || 'Mazmur Gusti Agung L'}
                  </div>
                  <div className="text-[11px] text-slate-600 font-semibold">
                    {formData.accountantTitle || formData.preparerTitle || 'Direktur Keuangan'}
                  </div>
                </div>
                <div className="p-2.5 bg-white rounded border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 font-medium">Disetujui oleh / Approved by:</div>
                  <div className="font-bold text-xs text-slate-900 underline mt-4">
                    {formData.directorName || formData.approverName || 'Direktur Utama'}
                  </div>
                  <div className="text-[11px] text-slate-600 font-semibold">
                    {formData.directorTitle || formData.approverTitle || 'Direktur Utama'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end pt-2">
            <button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Profil Perusahaan</span>
            </button>
          </div>
        </form>
      </div>

      {/* Backup & Restore Data */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
          <Download className="w-4 h-4 text-emerald-600" />
          <span>2. Cadangan & Pemulihan Basis Data (Backup & Restore)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Backup JSON */}
          <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                <Download className="w-4 h-4 text-blue-600" />
                <span>Cadangkan Data (JSON)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Unduh seluruh data COA, transaksi jurnal, pengaturan, dan histori log ke satu berkas JSON.
              </p>
            </div>
            <button 
              type="button"
              onClick={handleDownloadBackup}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-3 rounded shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh File Cadangan</span>
            </button>
          </div>

          {/* Restore JSON */}
          <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Pulihkan Data (JSON)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Unggah file JSON cadangan untuk memulihkan seluruh catatan pembukuan sebelumnya.
              </p>
            </div>
            <label className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer text-center">
              <Upload className="w-3.5 h-3.5" />
              <span>Pilih File Cadangan...</span>
              <input 
                type="file" 
                accept=".json" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </label>
          </div>

          {/* Full Excel Export */}
          <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3 flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Ekspor Excel (.xlsx)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Ekspor seluruh lembar kerja (COA, Jurnal Umum, Neraca Saldo, Laba Rugi) ke format Microsoft Excel.
              </p>
            </div>
            <button 
              type="button"
              onClick={handleExportFullWorkbook}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold py-2 px-3 rounded shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Unduh Semua Sheet Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* PWA Portal Installation Banner */}
      <PwaInstallBanner />

      {/* Info Notice: Cloud, Supabase & Reset moved to Administrator panel */}
      <div className="bg-sky-50 rounded-2xl border border-sky-200/80 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-[#0284c7] shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-sky-950 uppercase tracking-wide">
              Panel Cloud, Database Supabase, REST API &amp; Reset Terpusat
            </h4>
            <p className="text-xs text-sky-800/90 mt-0.5 max-w-2xl leading-relaxed">
              Integrasi REST API, status website Vercel/GitHub Mirror, sinkronisasi database PostgreSQL Supabase, pengaturan PIN otorisasi, dan zona kritis RESET sistem telah dipindahkan ke menu <b>Akses Khusus &gt; Administrator</b> di sidebar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
