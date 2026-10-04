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
  Check 
} from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';

interface ResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ResetModal: React.FC<ResetModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { resetWithPin } = useAccounting();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const res = resetWithPin(pin);
    if (res.success) {
      setIsSuccess(true);
      setSuccessInfo(res.message);
      setPin('');
      if (onSuccess) onSuccess();
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setErrorMsg('');
    setPin('');
    onClose();
  };

  return (
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-fadeIn border border-slate-200">
        
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
              {isSuccess ? 'Sistem Berhasil Direset' : 'Otorisasi Keamanan: Perintah RESET'}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={handleClose} 
            className="text-white/80 hover:text-white text-xl font-bold cursor-pointer"
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
                RESET SISTEM BERHASIL
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
                <span><b>0 Transaksi</b> (Semua jurnal umum, mutasi kas, & penyesuaian dihapus)</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span><b>Rp 0 Saldo Akun</b> (Seluruh saldo debet & kredit perkiraan akun dinolkan)</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span><b>Rp 0 Saldo Kontak</b> (Saldo piutang pelanggan & utang pemasok dinolkan)</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span><b>Laporan PSAK & Neraca</b> siap menerima data pembukuan baru</span>
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
                <span>PERINGATAN TINDAKAN KRITIS!</span>
              </p>
              <p>
                Tindakan <b>RESET SISTEM</b> akan <b>menghapus seluruh transaksi jurnal</b> (baik Jurnal Umum, Penyesuaian, Kas/Bank, Penjualan & Pembelian) dan <b>me-nol-kan kembali seluruh nominal saldo akun (Rp 0)</b> untuk memulai pembukuan baru yang bersih.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
              <div className="flex items-center space-x-1.5">
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Hapus Semua Jurnal</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Coins className="w-3.5 h-3.5 text-rose-500" />
                <span>Nol-kan Saldo Akun (Rp 0)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Masukkan PIN Keamanan Anda:
              </label>
              <div className="relative">
                <input 
                  type={showPin ? 'text' : 'password'}
                  required 
                  maxLength={12}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="Masukkan PIN (Bawaan: 1234)" 
                  className="w-full text-center tracking-widest text-base font-mono border-2 border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:border-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-600 bg-white"
                  autoFocus
                />
                <button 
                  type="button" 
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {errorMsg && (
                <div className="text-[11px] text-rose-600 font-semibold mt-1.5 flex items-center space-x-1">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button 
                type="button" 
                onClick={handleClose} 
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300 transition cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="submit" 
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center space-x-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Verifikasi & Lakukan RESET</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
