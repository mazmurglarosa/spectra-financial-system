import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, Filter, Download } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { Account, AccountCategory } from '../types/accounting';
import { formatRupiah, calculateAccountBalance, exportTableToExcel } from '../utils/accountingCalculations';
import { AccountModal } from '../components/modals/AccountModal';

export const AccountsView: React.FC = () => {
  const { accounts, transactions, deleteAccount } = useAccounting();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const categories: { key: string; label: string }[] = [
    { key: 'ALL', label: 'Semua Akun' },
    { key: 'HARTA_LANCAR', label: 'Harta Lancar' },
    { key: 'HARTA_TETAP', label: 'Harta Tetap' },
    { key: 'UTANG_LANCAR', label: 'Utang Lancar' },
    { key: 'UTANG_JANGKA_PANJANG', label: 'Utang Jk. Panjang' },
    { key: 'EKUITAS', label: 'Ekuitas / Modal' },
    { key: 'PENDAPATAN_OPERASIONAL', label: 'Pendapatan Usaha' },
    { key: 'PENDAPATAN_NON_OPERASIONAL', label: 'Pendapatan Lain' },
    { key: 'BEBAN_OPERASIONAL', label: 'Beban Usaha' },
  ];

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchSearch = acc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          acc.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'ALL' || acc.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [accounts, searchQuery, selectedCategory]);

  const handleEdit = (acc: Account) => {
    setEditingAccount(acc);
    setIsModalOpen(true);
  };

  const handleDelete = (acc: Account) => {
    if (confirm(`Yakin ingin menghapus akun ${acc.code} - ${acc.name}?`)) {
      const result = deleteAccount(acc.id);
      if (!result.success) {
        alert(result.message);
      }
    }
  };

  const handleExport = () => {
    const data: any[][] = [
      ['KODE', 'NAMA AKUN', 'KELOMPOK', 'POS LAPORAN', 'SALDO NORMAL', 'SALDO AWAL DEBET', 'SALDO AWAL KREDIT', 'SALDO AKHIR']
    ];

    filteredAccounts.forEach(acc => {
      const { endingBalance } = calculateAccountBalance(acc, transactions);
      data.push([
        acc.code,
        acc.name,
        acc.categoryName,
        acc.pos === 'Nrc' ? 'Neraca' : 'Laba Rugi',
        acc.sn === 'Db' ? 'Debit' : 'Kredit',
        acc.debetAwal,
        acc.kreditAwal,
        endingBalance
      ]);
    });

    exportTableToExcel(data, `Daftar_Akun_COA_SPECTRA_${new Date().toISOString().split('T')[0]}`, 'Bagan Akun');
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Filter and Action Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Cari kode atau nama akun..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '38px' }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleExport} className="btn btn-outline" style={{ fontSize: '0.825rem' }}>
            <Download size={15} />
            Export Excel
          </button>
          <button 
            onClick={() => { setEditingAccount(null); setIsModalOpen(true); }}
            className="btn btn-primary"
            style={{ fontSize: '0.825rem' }}
          >
            <Plus size={15} />
            Tambah Akun Baru
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px'
      }}>
        {categories.map(c => {
          const isActive = selectedCategory === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setSelectedCategory(c.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.78rem',
                fontWeight: isActive ? 700 : 500,
                backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-card)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-subtle)'}`,
                whiteSpace: 'nowrap'
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Accounts Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '10%' }}>Kode</th>
                <th style={{ width: '28%' }}>Nama Akun</th>
                <th style={{ width: '18%' }}>Kelompok</th>
                <th style={{ width: '8%', textAlign: 'center' }}>Pos</th>
                <th style={{ width: '8%', textAlign: 'center' }}>SN</th>
                <th style={{ width: '14%', textAlign: 'right' }}>Saldo Awal</th>
                <th style={{ width: '14%', textAlign: 'right' }}>Saldo Berjalan</th>
                <th style={{ width: '8%', textAlign: 'center' }} className="no-print">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Tidak ada akun yang sesuai dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acc => {
                  const { endingBalance } = calculateAccountBalance(acc, transactions);
                  const isHeader = acc.isHeader;

                  return (
                    <tr key={acc.id} style={{
                      backgroundColor: isHeader ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                      fontWeight: isHeader ? 700 : 400
                    }}>
                      <td className="mono" style={{ fontWeight: 700, color: isHeader ? '#38bdf8' : 'var(--text-main)' }}>
                        {acc.code}
                      </td>
                      <td>
                        <span style={{ color: isHeader ? '#fff' : 'var(--text-main)' }}>
                          {acc.name}
                        </span>
                        {acc.description && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {acc.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                          {acc.categoryName}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${acc.pos === 'Nrc' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                          {acc.pos}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                          {acc.sn}
                        </span>
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {acc.sn === 'Db' 
                          ? formatRupiah(acc.debetAwal) 
                          : formatRupiah(acc.kreditAwal)}
                      </td>
                      <td className="mono" style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: endingBalance < 0 ? '#fb7185' : 'var(--text-main)'
                      }}>
                        {formatRupiah(endingBalance)}
                      </td>
                      <td style={{ textAlign: 'center' }} className="no-print">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button 
                            onClick={() => handleEdit(acc)}
                            className="btn-ghost"
                            style={{ padding: '6px', borderRadius: '4px' }}
                            title="Edit Akun"
                          >
                            <Edit2 size={14} color="var(--primary)" />
                          </button>
                          <button 
                            onClick={() => handleDelete(acc)}
                            className="btn-ghost"
                            style={{ padding: '6px', borderRadius: '4px' }}
                            title="Hapus Akun"
                          >
                            <Trash2 size={14} color="#f43f5e" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AccountModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accountToEdit={editingAccount}
      />
    </div>
  );
};
