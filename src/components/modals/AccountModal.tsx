import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { useAccounting } from '../../context/AccountingContext';
import { Account, AccountCategory, NormalBalance, ReportType } from '../../types/accounting';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountToEdit?: Account | null;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, accountToEdit }) => {
  const { addAccount, updateAccount, accounts } = useAccounting();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isHeader, setIsHeader] = useState(false);
  const [category, setCategory] = useState<AccountCategory>('HARTA_LANCAR');
  const [pos, setPos] = useState<ReportType>('Nrc');
  const [sn, setSn] = useState<NormalBalance>('Db');
  const [debetAwal, setDebetAwal] = useState<number>(0);
  const [kreditAwal, setKreditAwal] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState('');

  const categoryOptions: { key: AccountCategory; label: string; defaultPos: ReportType; defaultSn: NormalBalance }[] = [
    { key: 'HARTA_LANCAR', label: 'Aset Lancar', defaultPos: 'Nrc', defaultSn: 'Db' },
    { key: 'HARTA_TETAP', label: 'Aset Tetap', defaultPos: 'Nrc', defaultSn: 'Db' },
    { key: 'UTANG_LANCAR', label: 'Kewajiban Lancar', defaultPos: 'Nrc', defaultSn: 'Kr' },
    { key: 'UTANG_JANGKA_PANJANG', label: 'Kewajiban Jangka Panjang', defaultPos: 'Nrc', defaultSn: 'Kr' },
    { key: 'EKUITAS', label: 'Ekuitas / Modal', defaultPos: 'Nrc', defaultSn: 'Kr' },
    { key: 'PENDAPATAN_OPERASIONAL', label: 'Pendapatan', defaultPos: 'Lr', defaultSn: 'Kr' },
    { key: 'PENDAPATAN_NON_OPERASIONAL', label: 'Pendapatan Lain', defaultPos: 'Lr', defaultSn: 'Kr' },
    { key: 'BEBAN_OPERASIONAL', label: 'Beban Operasional', defaultPos: 'Lr', defaultSn: 'Db' },
    { key: 'BEBAN_NON_OPERASIONAL', label: 'Beban Lain-lain', defaultPos: 'Lr', defaultSn: 'Db' },
  ];

  useEffect(() => {
    if (accountToEdit) {
      setCode(accountToEdit.code);
      setName(accountToEdit.name);
      setIsHeader(!!accountToEdit.isHeader);
      setCategory(accountToEdit.category);
      setPos(accountToEdit.pos);
      setSn(accountToEdit.sn);
      setDebetAwal(accountToEdit.debetAwal);
      setKreditAwal(accountToEdit.kreditAwal);
    } else {
      setCode('');
      setName('');
      setIsHeader(false);
      setCategory('HARTA_LANCAR');
      setPos('Nrc');
      setSn('Db');
      setDebetAwal(0);
      setKreditAwal(0);
    }
    setErrorMessage('');
  }, [accountToEdit, isOpen]);

  if (!isOpen) return null;

  const handleCategorySelect = (catKey: AccountCategory) => {
    setCategory(catKey);
    const found = categoryOptions.find(c => c.key === catKey);
    if (found) {
      setPos(found.defaultPos);
      setSn(found.defaultSn);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setErrorMessage('Kode akun dan nama akun wajib diisi.');
      return;
    }

    if (!accountToEdit) {
      const exists = accounts.some(a => a.code === code.trim());
      if (exists) {
        setErrorMessage(`Kode akun ${code} sudah ada! Gunakan kode lain.`);
        return;
      }
    }

    const catObj = categoryOptions.find(c => c.key === category);
    const categoryName = catObj?.label || 'Lainnya';

    if (accountToEdit) {
      updateAccount(accountToEdit.id, {
        name,
        isHeader,
        category,
        categoryName,
        pos,
        sn,
        debetAwal,
        kreditAwal
      });
      alert(`Akun ${code} berhasil diperbarui!`);
    } else {
      addAccount({
        code: code.trim(),
        name: name.trim(),
        isHeader,
        category,
        categoryName,
        pos,
        sn,
        debetAwal,
        kreditAwal
      });
      alert(`Akun ${code} berhasil ditambahkan!`);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-fadeIn border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center">
          <h3 className="font-bold text-base">
            {accountToEdit ? `Edit Akun: ${accountToEdit.code}` : 'Tambah Akun Baru (COA)'}
          </h3>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-white text-lg font-bold"
          >
            &times;
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 flex items-center space-x-1.5 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Kode Akun</label>
              <input 
                type="text" 
                required 
                disabled={!!accountToEdit}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="10001" 
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Tipe Akun</label>
              <select 
                value={isHeader ? 'header' : 'detail'} 
                onChange={e => setIsHeader(e.target.value === 'header')}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
              >
                <option value="detail">Detail (Bisa Dijurnal)</option>
                <option value="header">Header (Judul Sub-Akun)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 mb-1">Nama Akun</label>
            <input 
              type="text" 
              required 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Contoh: Kas Kecil, Piutang Usaha, Beban Gaji..." 
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 bg-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Kategori</label>
              <select 
                value={category} 
                onChange={e => handleCategorySelect(e.target.value as AccountCategory)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
              >
                {categoryOptions.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Pos Laporan</label>
              <select 
                value={pos} 
                onChange={e => setPos(e.target.value as ReportType)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
              >
                <option value="Nrc">Neraca (Nrc)</option>
                <option value="Lr">Laba Rugi (Lr)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Saldo Normal</label>
              <select 
                value={sn} 
                onChange={e => setSn(e.target.value as NormalBalance)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
              >
                <option value="Db">Debit (Db)</option>
                <option value="Kr">Kredit (Kr)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Saldo Awal Debit (Rp)</label>
              <input 
                type="number" 
                min="0"
                value={debetAwal || ''}
                onChange={e => setDebetAwal(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-right text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Saldo Awal Kredit (Rp)</label>
              <input 
                type="number" 
                min="0"
                value={kreditAwal || ''}
                onChange={e => setKreditAwal(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-right text-slate-900 bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-300 transition cursor-pointer"
            >
              Batal
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow transition cursor-pointer"
            >
              Simpan Akun
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
