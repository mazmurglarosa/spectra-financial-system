import { Account, AccountCategory, CompanySettings, Transaction, ReportType, NormalBalance } from '../types/accounting';

export const initialCompanySettings: CompanySettings = {
  companyName: 'CV Max Picture',
  businessType: 'Jasa & Perdagangan',
  fiscalPeriod: 'Desember 2021',
  fiscalYear: 2021,
  currency: 'IDR',
  taxRatePercent: 11,
  address: 'Jl. Pemuda No. 88, Jakarta Selatan',
  phone: '0812-3456-7890',
  email: 'finance@maxpicture.co.id',
  directorName: 'Mazmur Gusti Agung L',
  accountantName: 'Chief Financial Officer'
};

function getCategory(code: string): { category: AccountCategory; categoryName: string; isHeader: boolean } {
  const num = parseInt(code, 10);
  if (num === 10000) return { category: 'HARTA_LANCAR', categoryName: 'Harta Lancar', isHeader: true };
  if (num > 10000 && num < 11000) return { category: 'HARTA_LANCAR', categoryName: 'Harta Lancar', isHeader: false };
  
  if (num === 11000) return { category: 'HARTA_TETAP', categoryName: 'Harta Tetap', isHeader: true };
  if (num > 11000 && num < 20000) return { category: 'HARTA_TETAP', categoryName: 'Harta Tetap', isHeader: false };
  
  if (num === 20000) return { category: 'UTANG_LANCAR', categoryName: 'Utang Lancar', isHeader: true };
  if (num > 20000 && num < 21000) return { category: 'UTANG_LANCAR', categoryName: 'Utang Lancar', isHeader: false };
  
  if (num === 21000) return { category: 'UTANG_JANGKA_PANJANG', categoryName: 'Utang Jangka Panjang', isHeader: true };
  if (num > 21000 && num < 30000) return { category: 'UTANG_JANGKA_PANJANG', categoryName: 'Utang Jangka Panjang', isHeader: false };
  
  if (num >= 30000 && num < 40000) return { category: 'EKUITAS', categoryName: 'Modal / Ekuitas', isHeader: false };
  
  if (num === 40000) return { category: 'PENDAPATAN_OPERASIONAL', categoryName: 'Pendapatan Operasional', isHeader: true };
  if (num > 40000 && num < 41000) return { category: 'PENDAPATAN_OPERASIONAL', categoryName: 'Pendapatan Operasional', isHeader: false };
  
  if (num === 41000) return { category: 'PENDAPATAN_NON_OPERASIONAL', categoryName: 'Pendapatan Non Operasional', isHeader: true };
  if (num > 41000 && num < 50000) return { category: 'PENDAPATAN_NON_OPERASIONAL', categoryName: 'Pendapatan Non Operasional', isHeader: false };
  
  if (num === 50000) return { category: 'BEBAN_OPERASIONAL', categoryName: 'Beban Operasional', isHeader: true };
  if (num > 50000 && num < 60000) return { category: 'BEBAN_OPERASIONAL', categoryName: 'Beban Operasional', isHeader: false };
  
  return { category: 'BEBAN_NON_OPERASIONAL', categoryName: 'Beban Lain-lain', isHeader: false };
}

const rawAccounts: { code: string; name: string; pos: ReportType; sn: NormalBalance; debetAwal: number; kreditAwal: number }[] = [
  { code: '10000', name: 'Harta Lancar', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '10001', name: 'Kas', pos: 'Nrc', sn: 'Db', debetAwal: 100000, kreditAwal: 0 },
  { code: '10002', name: 'Persediaan Barang Dagang', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '10003', name: 'Piutang Usaha', pos: 'Nrc', sn: 'Db', debetAwal: 500000, kreditAwal: 0 },
  { code: '10004', name: 'Piutang Pendapatan', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '10005', name: 'Wesel Tagih', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '10006', name: 'Perlengkapan Kantor', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '10007', name: 'Perlengkapan Toko', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '10008', name: 'Iklan Dibayar Dimuka', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '10009', name: 'Sewa Dibayar Dimuka', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '10010', name: 'Asuransi Dibayar Dimuka', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },

  { code: '11000', name: 'Harta Tetap', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '11001', name: 'Peralatan Kantor', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '11002', name: 'Akumulasi Penyusutan Peralatan Kantor', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '11003', name: 'Kendaraan', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '11004', name: 'Akumulasi Penyusutan Peralatanan Kendaraan', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '11005', name: 'Gedung', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '11006', name: 'Akumulasi Penyusutan Gedung', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '11007', name: 'Mesin', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '11008', name: 'Akumulasi Penyusutan Mesin', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '11009', name: 'Peralatan Toko', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '11010', name: 'Akumulasi Penyusutan Peralatan Toko', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '11011', name: 'Tanah', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },

  { code: '20000', name: 'Utang / Kewajiban Lancar', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '20001', name: 'Utang Usaha/Dagang', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '20002', name: 'Utang Wesel', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '20003', name: 'Utang Gaji', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '20004', name: 'Utang Pajak Penghasilan', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '20005', name: 'Utang Hipotek', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '20006', name: 'Utang Obligasi', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '20007', name: 'Pendapatan Diterima Dimuka', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '20008', name: 'Utang Utilitas', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },

  { code: '21000', name: 'Utang Non Operasional', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '21001', name: 'Utang Sewa', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '21002', name: 'Utang Bank', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '21003', name: 'Utang Bunga', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },

  { code: '30000', name: 'Modal/Ekuitas', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 100000 },
  { code: '30001', name: 'Prive', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '30002', name: 'Ikhtisar Laba Rugi', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },

  { code: '40000', name: 'Pendapatan Operasional', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40001', name: 'Pendapatan Jasa / Usaha', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40002', name: 'Retur Penjualan', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40003', name: 'Potongan Penjualan', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40004', name: 'Pembelian', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40005', name: 'Retur Pembelian', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 1000000 },
  { code: '40006', name: 'Beban Angkut Pembelian', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40007', name: 'IRL', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40008', name: 'Potongan Pembelian', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },

  { code: '41000', name: 'Pendapatan Non Operasional', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '41001', name: 'Pendapatan Bunga', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },

  { code: '50000', name: 'Beban Operasional', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50001', name: 'Beban Gaji Toko', pos: 'Lr', sn: 'Db', debetAwal: 500000, kreditAwal: 0 },
  { code: '50002', name: 'Beban Gaji Kantor', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50003', name: 'Beban Sewa Lahan', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50004', name: 'Beban Asuransi', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50005', name: 'Beban Penyesuaian Piutang', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50006', name: 'Beban Perlengkapan Kantor', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50007', name: 'Beban Perlengkapan Toko', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50008', name: 'Beban Iklan', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50009', name: 'Beban Penyusutan Peralatan kantor', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50010', name: 'Beban Penyusutan Gedung', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50011', name: 'Beban Bunga', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50012', name: 'Beban Listrik Dan Telepon', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50013', name: 'Beban Penyusutan Mesin', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50014', name: 'Beban Lain-Lain', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50015', name: 'Beban Penyusutan Kendaraan', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50016', name: 'Potongan Pembelian', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50017', name: 'Beban Penjualan', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50018', name: 'Pajak Penghasilan', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50019', name: 'Beban Penyusutan Peralatan toko', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50020', name: 'Beban Service', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50021', name: 'Beban Akibat Bencana Alam', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
];

export const defaultAccounts: Account[] = rawAccounts.map(item => {
  const cat = getCategory(item.code);
  return {
    ...item,
    id: `acc_${item.code}`,
    category: cat.category,
    categoryName: cat.categoryName,
    isHeader: cat.isHeader
  };
});

export const defaultTransactions: Transaction[] = [
  {
    id: 'trx_001',
    date: '2021-12-01',
    refNumber: 'BKK-001',
    description: 'Pembelian perlengkapan kantor secara tunai',
    lines: [
      {
        id: 'line_1_1',
        accountId: 'acc_10006',
        accountCode: '10006',
        accountName: 'Perlengkapan Kantor',
        debit: 20000,
        credit: 0,
        memo: 'Pembelian alat tulis kantor'
      },
      {
        id: 'line_1_2',
        accountId: 'acc_10001',
        accountCode: '10001',
        accountName: 'Kas',
        debit: 0,
        credit: 20000,
        memo: 'Pengeluaran kas kecil'
      }
    ],
    totalDebit: 20000,
    totalCredit: 20000,
    createdAt: Date.now() - 86400000 * 25,
    updatedAt: Date.now() - 86400000 * 25,
    partner: 'Toko Buku & ATK Sejahtera'
  },
  {
    id: 'trx_002',
    date: '2021-12-05',
    refNumber: 'BM-001',
    description: 'Pemakaian perlengkapan kantor untuk operasional',
    lines: [
      {
        id: 'line_2_1',
        accountId: 'acc_50006',
        accountCode: '50006',
        accountName: 'Beban Perlengkapan Kantor',
        debit: 10000,
        credit: 0,
        memo: 'Penyesuaian perlengkapan terpakai'
      },
      {
        id: 'line_2_2',
        accountId: 'acc_10006',
        accountCode: '10006',
        accountName: 'Perlengkapan Kantor',
        debit: 0,
        credit: 10000,
        memo: 'Pengurangan stok perlengkapan'
      }
    ],
    totalDebit: 10000,
    totalCredit: 10000,
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now() - 86400000 * 20,
    partner: 'Divisi Operasional'
  },
  {
    id: 'trx_003',
    date: '2021-12-10',
    refNumber: 'BKM-001',
    description: 'Penerimaan pelunasan piutang usaha dari klien',
    lines: [
      {
        id: 'line_3_1',
        accountId: 'acc_10001',
        accountCode: '10001',
        accountName: 'Kas',
        debit: 250000,
        credit: 0,
        memo: 'Penerimaan transfer pembayaran termin 1'
      },
      {
        id: 'line_3_2',
        accountId: 'acc_10003',
        accountCode: '10003',
        accountName: 'Piutang Usaha',
        debit: 0,
        credit: 250000,
        memo: 'Pelunasan faktur INV-091'
      }
    ],
    totalDebit: 250000,
    totalCredit: 250000,
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now() - 86400000 * 15,
    partner: 'PT Media Utama Sentosa'
  },
  {
    id: 'trx_004',
    date: '2021-12-15',
    refNumber: 'BKM-002',
    description: 'Penerimaan pendapatan jasa produksi video / foto',
    lines: [
      {
        id: 'line_4_1',
        accountId: 'acc_10001',
        accountCode: '10001',
        accountName: 'Kas',
        debit: 750000,
        credit: 0,
        memo: 'Pembayaran jasa tunai'
      },
      {
        id: 'line_4_2',
        accountId: 'acc_40001',
        accountCode: '40001',
        accountName: 'Pendapatan Jasa / Usaha',
        debit: 0,
        credit: 750000,
        memo: 'Pendapatan jasa liputan event'
      }
    ],
    totalDebit: 750000,
    totalCredit: 750000,
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 10,
    partner: 'CV Bintang Sembilan'
  },
  {
    id: 'trx_005',
    date: '2021-12-25',
    refNumber: 'BKK-002',
    description: 'Pembayaran beban listrik, air, dan internet kantor',
    lines: [
      {
        id: 'line_5_1',
        accountId: 'acc_50012',
        accountCode: '50012',
        accountName: 'Beban Listrik Dan Telepon',
        debit: 85000,
        credit: 0,
        memo: 'Tagihan PLN & Indihome bulan berjalan'
      },
      {
        id: 'line_5_2',
        accountId: 'acc_10001',
        accountCode: '10001',
        accountName: 'Kas',
        debit: 0,
        credit: 85000,
        memo: 'Pembayaran via kas'
      }
    ],
    totalDebit: 85000,
    totalCredit: 85000,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 5,
    partner: 'PLN & Telkom'
  }
];
