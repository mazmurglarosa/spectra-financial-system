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
  const [category, setCategory] = useState<AccountCategory>('HARTA_LANCAR');
  const [pos, setPos] = useState<ReportType>('Nrc');
  const [sn, setSn] = useState<NormalBalance>('Db');
  const [debetAwal, setDebetAwal] = useState<number>(0);
  const [kreditAwal, setKreditAwal] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const categoryOptions: { key: AccountCategory; label: string; defaultPos: ReportType; defaultSn: NormalBalance }[] = [
    { key: 'HARTA_LANCAR', label: 'Harta Lancar', defaultPos: 'Nrc', defaultSn: 'Db' },
    { key: 'HARTA_TETAP', label: 'Harta Tetap', defaultPos: 'Nrc', defaultSn: 'Db' },
    { key: 'UTANG_LANCAR', label: 'Utang / Kewajiban Lancar', defaultPos: 'Nrc', defaultSn: 'Db' },
    { key: 'UTANG_JANGKA_PANJANG', label: 'Utang Jangka Panjang', defaultPos: 'Nrc', defaultSn: 'Db' },
    { key: 'EKUITAS', label: 'Modal / Ekuitas', defaultPos: 'Nrc', defaultSn: 'Kr' },
    { key: 'PENDAPATAN_OPERASIONAL', label: 'Pendapatan Operasional', defaultPos: 'Lr', defaultSn: 'Kr' },
    { key: 'PENDAPATAN_NON_OPERASIONAL', label: 'Pendapatan Non Operasional', defaultPos: 'Lr', defaultSn: 'Kr' },
    { key: 'BEBAN_OPERASIONAL', label: 'Beban Operasional', defaultPos: 'Lr', defaultSn: 'Db' },
    { key: 'BEBAN_NON_OPERASIONAL', label: 'Beban Non Operasional', defaultPos: 'Lr', defaultSn: 'Db' },
  ];

  useEffect(() => {
    if (accountToEdit) {
      setCode(accountToEdit.code);
      setName(accountToEdit.name);
      setCategory(accountToEdit.category);
      setPos(accountToEdit.pos);
      setSn(accountToEdit.sn);
      setDebetAwal(accountToEdit.debetAwal);
      setKreditAwal(accountToEdit.kreditAwal);
      setDescription(accountToEdit.description || '');
    } else {
      setCode('');
      setName('');
      setCategory('HARTA_LANCAR');
      setPos('Nrc');
      setSn('Db');
      setDebetAwal(0);
      setKreditAwal(0);
      setDescription('');
    }
    setErrorMessage('');
  }, [accountToEdit, isOpen]);

  if (!isOpen) return null;

  const handleCategoryChange = (catKey: AccountCategory) => {
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
        setErrorMessage(`Kode akun ${code} sudah ada. Silakan gunakan kode lain.`);
        return;
      }
    }

    const catObj = categoryOptions.find(c => c.key === category);
    const categoryName = catObj?.label || 'Lainnya';

    if (accountToEdit) {
      updateAccount(accountToEdit.id, {
        name,
        category,
        categoryName,
        pos,
        sn,
        debetAwal,
        kreditAwal,
        description
      });
    } else {
      addAccount({
        code: code.trim(),
        name: name.trim(),
        category,
        categoryName,
        pos,
        sn,
        debetAwal,
        kreditAwal,
        description,
        isHeader: false
      });
    }

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
              {accountToEdit ? 'Edit Akun' : 'Tambah Akun Baru'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Klasifikasi akun bagan perkiraan (Chart of Accounts) Accurate.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px', borderRadius: '50%' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {errorMessage && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              color: '#fb7185',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Kode Akun *
              </label>
              <input 
                type="text" 
                placeholder="Misal: 10025" 
                value={code} 
                onChange={e => setCode(e.target.value)} 
                disabled={!!accountToEdit}
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Nama Akun *
              </label>
              <input 
                type="text" 
                placeholder="Misal: Bank Mandiri Operasional" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Klasifikasi Kelompok Akun
            </label>
            <select 
              value={category} 
              onChange={e => handleCategoryChange(e.target.value as AccountCategory)}
            >
              {categoryOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Pos Laporan
              </label>
              <select value={pos} onChange={e => setPos(e.target.value as ReportType)}>
                <option value="Nrc">Nrc (Neraca / Posisi Keuangan)</option>
                <option value="Lr">Lr (Laba Rugi)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Saldo Normal (SN)
              </label>
              <select value={sn} onChange={e => setSn(e.target.value as NormalBalance)}>
                <option value="Db">Db (Debet)</option>
                <option value="Kr">Kr (Kredit)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Saldo Awal Debet (Rp)
              </label>
              <input 
                type="number" 
                min="0"
                step="any"
                value={debetAwal || ''} 
                onChange={e => setDebetAwal(parseFloat(e.target.value) || 0)} 
                placeholder="0"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Saldo Awal Kredit (Rp)
              </label>
              <input 
                type="number" 
                min="0"
                step="any"
                value={kreditAwal || ''} 
                onChange={e => setKreditAwal(parseFloat(e.target.value) || 0)} 
                placeholder="0"
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Catatan / Deskripsi (Opsional)
            </label>
            <input 
              type="text" 
              placeholder="Deskripsi fungsi akun" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} />
              {accountToEdit ? 'Simpan Akun' : 'Tambah Akun'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
