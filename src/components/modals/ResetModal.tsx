import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Eye, EyeOff, RefreshCw, XCircle } from 'lucide-react';
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const res = resetWithPin(pin);
    if (res.success) {
      alert(res.message);
      setPin('');
      onClose();
      if (onSuccess) onSuccess();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden animate-fadeIn border border-slate-200">
        
        {/* Header */}
        <div className="bg-rose-700 text-white px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-rose-200" />
            <h3 className="font-bold text-sm">Otorisasi Keamanan: Perintah RESET</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-rose-200 hover:text-white text-lg font-bold"
          >
            &times;
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 space-y-1">
            <p className="font-bold flex items-center space-x-1">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>PERINGATAN TINDAKAN KRITIS!</span>
            </p>
            <p>
              Tindakan <b>RESET</b> akan menghapus seluruh transaksi jurnal (baik Jurnal Umum maupun Penyesuaian) dan me-nol-kan kembali seluruh nominal saldo akun (Rp 0) untuk memulai pembukuan baru yang bersih.
            </p>
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
                className="w-full text-center tracking-widest text-base font-mono border-2 border-slate-300 rounded px-3 py-2 text-slate-900 focus:border-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-600 bg-white"
                autoFocus
              />
              <button 
                type="button" 
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
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
              onClick={onClose} 
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-300 transition"
            >
              Batal
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded shadow flex items-center space-x-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Verifikasi & Lakukan RESET</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
