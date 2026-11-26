import React, { useState } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  XCircle, 
  CheckCircle2, 
  Trash2, 
  Coins, 
  Check,
  Download,
  Database,
  FileSpreadsheet,
  FolderLock
} from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';

interface ResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ResetModal: React.FC<ResetModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { resetWithPin, exportDatabaseJson, transactions } = useAccounting();
  const [pin, setPin] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [preserveDrive, setPreserveDrive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState('');
  const [resetStats, setResetStats] = useState<{ deletedCount: number; spreadsheetOk: boolean } | null>(null);

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    try {
      const jsonStr = exportDatabaseJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spectra_backup_pre_reset_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupDownloaded(true);
    } catch (e: any) {
      setErrorMsg('Gagal mengunduh cadangan: ' + e?.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (confirmText.trim() !== 'RESET-SPECTRA') {
      setErrorMsg('Ketik "RESET-SPECTRA" dengan tepat pada kotak konfirmasi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetWithPin(pin, {
        confirmCode: 'RESET-SPECTRA',
        clearDrive: !preserveDrive,
        zeroAccounts: true
      });

      if (res.success) {
        setIsSuccess(true);
        setSuccessInfo(res.message);
        setResetStats({
          deletedCount: res.deletedTransactionsCount || 0,
          spreadsheetOk: res.spreadsheetReset ?? true
        });
        setPin('');
        setConfirmText('');
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengeksekusi reset sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setIsSuccess(false);
    setErrorMsg('');
    setPin('');
    setConfirmText('');
    setBackupDownloaded(false);
    setResetStats(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-fadeIn border border-slate-200">
        
        {/* Header */}
        <div className={`text-white px-5 py-3.5 flex justify-between items-center transition-colors ${
          isSuccess ? 'bg-emerald-700' : 'bg-rose-700'
        }`}>
          <div className="flex items-center space-x-2">
            {isSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-200" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-200" />
            )}
            <h3 className="font-bold text-sm">
              {isSuccess ? 'Sistem Berhasil Direset' : 'Otorisasi Keamanan: Perintah RESET SISTEM'}
            </h3>
          </div>
          <button 
            type="button" 
            disabled={isSubmitting}
            onClick={handleClose} 
            className="text-white/80 hover:text-white text-xl font-bold cursor-pointer disabled:opacity-50"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        {isSuccess ? (
          <div className="p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                RESET SISTEM TOTAL BERHASIL
              </h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                {successInfo || 'Semua transaksi dan jurnal telah dibersihkan menjadi 0, dan seluruh saldo perkiraan akun telah dinol-kan (Rp 0).'}
              </p>
            </div>

            {/* Checklist items */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span><b>Database Cloud &amp; Lokal:</b> 0 Transaksi (dihapus bersih dari tabel transaksi)</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span><b>Master Bagan Akun:</b> 76 Akun COA tetap utuh (seluruh saldo dinolkan Rp 0)</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span><b>Google Spreadsheet ("datasheet_bukti_transaksi"):</b> Baris A6:K dikosongkan (Header baris 1-5 aman)</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span><b>Google Drive:</b> {preserveDrive ? 'File bukti transaksi dipertahankan aman di folder' : 'File bukti transaksi dibersihkan'}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span><b>Nomor Berkas Auto Record:</b> Kembali mulai dari hitungan awal 1 (<b>BT/0001/...</b>)</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span><b>Cache Browser:</b> LocalStorage, IndexedDB media, &amp; Antrean draft jurnal dibersihkan</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg shadow-sm flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mulai Pembukuan Baru yang Bersih</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
              <p className="font-bold flex items-center space-x-1">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>PERINGATAN TINDAKAN KRITIS: RESET PEMBUKUAN</span>
              </p>
              <p>
                Tindakan ini akan <b>menghapus seluruh transaksi jurnal ({transactions.length} transaksi)</b> dan <b>me-nol-kan saldo awal akun (Rp 0)</b> untuk memulai periode baru.
              </p>
              <p className="text-[11px] text-rose-700 font-medium">
                🛡️ <b>Yang tetap aman:</b> 76 Akun Bagan Perkiraan (COA), Rekanan, Pengguna sistem, dan Pengaturan Perusahaan.
              </p>
            </div>

            {/* Tombol Cadangan Pra-Reset */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  <span>Cadangkan Data Sebelum Reset</span>
                </div>
                <div className="text-[10.5px] text-slate-500">
                  Unduh snapshot JSON ({transactions.length} transaksi) sebagai arsip.
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadBackup}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
                  backupDownloaded
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{backupDownloaded ? 'Tercadangkan' : 'Unduh JSON'}</span>
              </button>
            </div>

            {/* Opsi Google Drive */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preserveDrive}
                  onChange={e => setPreserveDrive(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">Pertahankan berkas di Google Drive (Direkomendasikan)</span>
                  <span className="text-[11px] text-slate-500 block">
                    Data transaksi di Spreadsheet akan dikosongkan (A6:K), namun dokumen nota asli di Google Drive tetap tersimpan aman.
                  </span>
                </div>
              </label>
            </div>

            {/* Input PIN & Konfirmasi Teks */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Masukkan PIN Otorisasi Reset:
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    required
                    maxLength={12}
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    placeholder="Masukkan PIN Keamanan (Bawaan: 1234)"
                    className="w-full text-center tracking-widest text-base font-mono border-2 border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:border-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-600 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2. Konfirmasi Teks (Ketik <code className="bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-mono font-bold">RESET-SPECTRA</code>):
                </label>
                <input
                  type="text"
                  required
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="Ketik RESET-SPECTRA di sini"
                  className="w-full text-center font-mono font-bold uppercase text-xs border-2 border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:border-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-600 bg-white"
                />
              </div>

              {errorMsg && (
                <div className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center space-x-1">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button 
                type="button" 
                disabled={isSubmitting}
                onClick={handleClose} 
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300 transition cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting || confirmText.trim() !== 'RESET-SPECTRA'}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengeksekusi Reset...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Verifikasi &amp; Eksekusi RESET</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
