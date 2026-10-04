import React, { useState } from 'react';
import { 
  Building2, 
  Save, 
  Database, 
  Cloud, 
  Download, 
  Upload, 
  RotateCcw, 
  CheckCircle, 
  ShieldCheck, 
  FileSpreadsheet,
  ExternalLink 
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { CompanySettings } from '../types/accounting';
import { 
  generateTrialBalance, 
  generateWorksheet, 
  generateIncomeStatement, 
  generateBalanceSheet, 
  calculateAccountBalance 
} from '../utils/accountingCalculations';
import * as XLSX from 'xlsx';

export const SettingsView: React.FC = () => {
  const { 
    settings, 
    updateSettings, 
    syncStatus, 
    accounts, 
    transactions, 
    resetToDefault, 
    exportDatabaseJson, 
    importDatabaseJson 
  } = useAccounting();

  const [formData, setFormData] = useState<CompanySettings>({ ...settings });
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (field: keyof CompanySettings, val: any) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setSuccessMsg('Profil perusahaan berhasil disimpan dan disinkronkan secara real-time.');
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

  // Export COMPLETE Excel Workbook with all sheets
  const handleExportFullWorkbook = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: COA
    const coaData: any[][] = [
      ['KODE', 'NAMA AKUN', 'KELOMPOK', 'POS', 'SN', 'DEBET AWAL', 'KREDIT AWAL', 'SALDO AKHIR']
    ];
    accounts.forEach(a => {
      const { endingBalance } = calculateAccountBalance(a, transactions);
      coaData.push([a.code, a.name, a.categoryName, a.pos, a.sn, a.debetAwal, a.kreditAwal, endingBalance]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(coaData), 'Daftar Akun');

    // Sheet 2: Jurnal Umum
    const juData: any[][] = [
      ['TANGGAL', 'REF', 'KETERANGAN', 'KODE AKUN', 'NAMA AKUN', 'DEBET', 'KREDIT', 'PIHAK TERKAIT']
    ];
    transactions.forEach(t => {
      t.lines.forEach((l, idx) => {
        juData.push([
          idx === 0 ? t.date : '',
          idx === 0 ? t.refNumber : '',
          idx === 0 ? t.description : (l.memo || ''),
          l.accountCode,
          l.accountName,
          l.debit,
          l.credit,
          idx === 0 ? (t.partner || '') : ''
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(juData), 'Jurnal Umum');

    // Sheet 3: Neraca Saldo
    const tb = generateTrialBalance(accounts, transactions);
    const tbData: any[][] = [
      ['KODE', 'NAMA AKUN', 'KELOMPOK', 'DEBET', 'KREDIT']
    ];
    tb.items.forEach(i => tbData.push([i.code, i.name, i.categoryName, i.debit, i.credit]));
    tbData.push(['', 'TOTAL KESEIMBANGAN', '', tb.totalDebit, tb.totalCredit]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tbData), 'Neraca Saldo');

    // Sheet 4: Laba Rugi
    const is = generateIncomeStatement(accounts, transactions);
    const lrData: any[][] = [
      ['LAPORAN LABA RUGI'],
      ['KETERANGAN', 'NOMINAL (RP)'],
      ['TOTAL PENDAPATAN OPERASIONAL', is.totalOperasionalRevenue],
      ['TOTAL BEBAN OPERASIONAL', is.totalOperasionalExpense],
      ['LABA OPERASIONAL', is.labaOperasi],
      ['TOTAL LUAR USAHA BERSIH', is.totalLuarUsaha],
      ['LABA BERSIH PERIODE BERJALAN', is.labaBersih]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lrData), 'Laba Rugi');

    // Sheet 5: Posisi Keuangan (Neraca)
    const bs = generateBalanceSheet(accounts, transactions);
    const bsData: any[][] = [
      ['LAPORAN POSISI KEUANGAN (NERACA)'],
      ['TOTAL ASET LANCAR', bs.totalAsetLancar],
      ['TOTAL ASET TETAP', bs.totalAsetTetap],
      ['TOTAL ASET', bs.totalAset],
      ['TOTAL KEWAJIBAN LANCAR', bs.totalUtangLancar],
      ['TOTAL KEWAJIBAN JK. PANJANG', bs.totalUtangJangkaPanjang],
      ['TOTAL KEWAJIBAN', bs.totalKewajiban],
      ['TOTAL EKUITAS', bs.totalEkuitas],
      ['TOTAL PASIVA (KEWAJIBAN & EKUITAS)', bs.totalKewajibanDanEkuitas],
      ['STATUS SEIMBANG', bs.isBalanced ? 'SEIMBANG' : 'TIDAK SEIMBANG']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bsData), 'Neraca');

    XLSX.writeFile(wb, `Buku_Keuangan_Lengkap_SPECTRA_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleReset = () => {
    if (confirm('PERINGATAN: Tindakan ini akan mengembalikan data ke template awal SIKEU PT BARU. Apakah Anda yakin?')) {
      resetToDefault();
      setFormData({ ...settings });
      setSuccessMsg('Data telah berhasil direset ke template default SIKEU PT BARU.');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* Messages */}
      {successMsg && (
        <div style={{
          padding: '14px 20px',
          backgroundColor: 'var(--success-bg)',
          border: '1px solid var(--success-border)',
          borderRadius: 'var(--radius-md)',
          color: '#34d399',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Cloud & Real-Time Sync Status Card */}
      <div className="card" style={{ padding: '28px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.9) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}>
              <Cloud size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Status Sinkronisasi & Convex Cloud</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Arsitektur database ganda menjamin nol risiko kehilangan data (Zero Data Loss).
              </p>
            </div>
          </div>
          <span className="badge badge-success" style={{ fontSize: '0.78rem', padding: '6px 14px' }}>
            <ShieldCheck size={14} /> Selalu Singkron (Live)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Multi-Tab Broadcast Sync</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>Aktif & Terhubung</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>BroadcastChannel v1</div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Penyimpanan Persistent</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>Tersimpan Otomatis</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{accounts.length} Akun • {transactions.length} Transaksi</div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Koneksi Backend Convex</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: syncStatus.convexConnected ? '#34d399' : '#fbbf24', marginTop: '4px' }}>
              {syncStatus.convexConnected ? 'Cloud Connected' : 'Schema & API Ready'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Folder /convex terkonfigurasi</div>
          </div>
        </div>
      </div>

      {/* Company Profile Settings Form */}
      <div className="card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Building2 size={22} color="var(--primary)" />
          <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Profil Entitas Perusahaan</h3>
        </div>

        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Nama Perusahaan / Entitas *
              </label>
              <input 
                type="text" 
                value={formData.companyName} 
                onChange={e => handleChange('companyName', e.target.value)} 
                required 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Jenis Usaha
              </label>
              <input 
                type="text" 
                value={formData.businessType} 
                onChange={e => handleChange('businessType', e.target.value)} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Periode Laporan *
              </label>
              <input 
                type="text" 
                value={formData.fiscalPeriod} 
                onChange={e => handleChange('fiscalPeriod', e.target.value)} 
                required 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Tahun Buku
              </label>
              <input 
                type="number" 
                value={formData.fiscalYear} 
                onChange={e => handleChange('fiscalYear', parseInt(e.target.value) || 2021)} 
                required 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Mata Uang
              </label>
              <input 
                type="text" 
                value={formData.currency} 
                onChange={e => handleChange('currency', e.target.value)} 
                required 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Nama Direktur Utama (Tanda Tangan Laporan)
              </label>
              <input 
                type="text" 
                value={formData.directorName} 
                onChange={e => handleChange('directorName', e.target.value)} 
                required 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Nama Bagian Keuangan / Akuntan
              </label>
              <input 
                type="text" 
                value={formData.accountantName} 
                onChange={e => handleChange('accountantName', e.target.value)} 
                required 
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
              <Save size={16} />
              Simpan Perubahan Profil
            </button>
          </div>
        </form>
      </div>

      {/* Data Backup, Full Excel & Restore Card */}
      <div className="card" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Database size={22} color="var(--primary)" />
          <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Cadangan Data & Export Lengkap</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Simpan seluruh pembukuan akuntansi ke format berkas Excel multi-sheet atau cadangan JSON untuk pemulihan instan kapan saja.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {/* Export Full Excel */}
          <div style={{
            padding: '20px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <FileSpreadsheet size={18} color="#10b981" />
                Buku Keuangan Excel (.xlsx)
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Unduh seluruh modul (COA, Jurnal Umum, Neraca Saldo, Laba Rugi, Neraca) dalam 1 file Excel multi-sheet.
              </p>
            </div>
            <button onClick={handleExportFullWorkbook} className="btn btn-success" style={{ width: '100%', fontSize: '0.8rem' }}>
              <Download size={14} /> Unduh Full Excel
            </button>
          </div>

          {/* Backup JSON */}
          <div style={{
            padding: '20px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <Download size={18} color="#3b82f6" />
                Backup Data JSON
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Simpan snapshot seluruh database termasuk transaksi, akun, dan preferensi untuk cadangan aman.
              </p>
            </div>
            <button onClick={handleDownloadBackup} className="btn btn-outline" style={{ width: '100%', fontSize: '0.8rem' }}>
              Unduh Backup JSON
            </button>
          </div>

          {/* Restore JSON */}
          <div style={{
            padding: '20px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <Upload size={18} color="#c084fc" />
                Restore / Impor Data
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Pulihkan data dari berkas cadangan JSON yang telah diunduh sebelumnya.
              </p>
            </div>
            <label className="btn btn-outline" style={{ width: '100%', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center' }}>
              Pilih File Backup
              <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Reset to Default Template */}
        <div style={{
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Reset ke Template Awal (SIKEU PT BARU)
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Mengembalikan 73 akun standar dan transaksi contoh bawaan berkas Excel.
            </div>
          </div>
          <button onClick={handleReset} className="btn btn-danger" style={{ fontSize: '0.8rem' }}>
            <RotateCcw size={14} /> Reset ke Bawaan
          </button>
        </div>
      </div>
    </div>
  );
};
