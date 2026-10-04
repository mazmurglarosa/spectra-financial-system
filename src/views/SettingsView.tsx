import React, { useState } from 'react';
import { 
  Building2, 
  Save, 
  Download, 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  Key, 
  FileSpreadsheet, 
  RefreshCw 
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
import { ResetModal } from '../components/modals/ResetModal';
import * as XLSX from 'xlsx';

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    accounts, 
    transactions, 
    exportDatabaseJson, 
    importDatabaseJson,
    changePin 
  } = useAccounting();

  const [formData, setFormData] = useState<CompanySettings>({ ...settings });
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // PIN change state
  const [currPin, setCurrPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinFeedback, setPinFeedback] = useState<{ message: string; isSuccess: boolean } | null>(null);

  // Reset modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const handleChange = (field: keyof CompanySettings, val: any) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setSuccessMsg('Profil entitas berhasil disimpan dan disinkronkan secara real-time.');
    setTimeout(() => setSuccessMsg(''), 4000);
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

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      setPinFeedback({ message: 'Konfirmasi PIN Baru tidak cocok!', isSuccess: false });
      return;
    }
    const res = changePin(currPin, newPin);
    setPinFeedback({ message: res.message, isSuccess: res.success });
    if (res.success) {
      setCurrPin('');
      setNewPin('');
      setConfirmPin('');
    }
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

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Direktur / Pimpinan</label>
            <input 
              type="text" 
              value={formData.directorName}
              onChange={e => handleChange('directorName', e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Akuntan / Penyusun</label>
            <input 
              type="text" 
              value={formData.accountantName}
              onChange={e => handleChange('accountantName', e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5"
            />
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

      {/* Security PIN Change */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
          <Key className="w-4 h-4 text-rose-600" />
          <span>3. Pengaturan PIN Keamanan Otorisasi RESET</span>
        </h3>

        <form onSubmit={handlePinSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs max-w-2xl">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">PIN Saat Ini</label>
            <input 
              type="password" 
              required 
              value={currPin}
              onChange={e => setCurrPin(e.target.value)}
              placeholder="PIN saat ini (bawaan: 1234)" 
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-center bg-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">PIN Baru (min 4 digit)</label>
            <input 
              type="password" 
              required 
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              placeholder="PIN baru..." 
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-center bg-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Konfirmasi PIN Baru</label>
            <input 
              type="password" 
              required 
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              placeholder="Konfirmasi..." 
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-center bg-white"
            />
          </div>

          <div className="sm:col-span-3 flex items-center justify-between pt-2">
            <div>
              {pinFeedback && (
                <span className={`font-semibold ${pinFeedback.isSuccess ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {pinFeedback.message}
                </span>
              )}
            </div>
            <button 
              type="submit" 
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-1.5 rounded shadow-xs cursor-pointer"
            >
              Simpan PIN Baru
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone: PIN Protected RESET */}
      <div className="bg-rose-50 rounded-xl shadow-xs border-2 border-rose-200 p-5 space-y-3">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <h3 className="font-bold text-sm text-rose-900">
            4. Zona Kritis: RESET Pembukuan Periode Baru
          </h3>
        </div>
        <p className="text-xs text-rose-800 max-w-2xl leading-relaxed">
          Tindakan ini akan <b>menghapus seluruh transaksi jurnal</b> (baik Jurnal Umum maupun Penyesuaian) dan me-nol-kan kembali seluruh nominal saldo akun perkiraan (Rp 0) untuk memulai pembukuan periode baru yang bersih. Tindakan ini dilindungi oleh PIN keamanan otorisasi.
        </p>

        <div className="pt-2">
          <button 
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm flex items-center space-x-2 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>RESET SISTEM (DENGAN PROTEKSI PIN)</span>
          </button>
        </div>
      </div>

      {/* Reset Modal */}
      <ResetModal 
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
      />
    </div>
  );
};
