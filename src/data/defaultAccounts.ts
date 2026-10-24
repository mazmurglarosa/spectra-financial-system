import { Account, AccountCategory, CompanySettings, Transaction, ReportType, NormalBalance } from '../types/accounting';

export const initialCompanySettings: CompanySettings = {
  companyName: 'PT Nirwana Bhumi Energi',
  businessType: 'Jasa Kontraktor & Energi',
  fiscalPeriod: 'Oktober 2026',
  fiscalYear: 2026,
  currency: 'IDR',
  taxRatePercent: 11,
  address: 'Jalan Kebenaran dan Hidup',
  phone: '0812-3456-7890',
  email: 'finance@nirwanabhumi.co.id',
  directorName: 'Sudono Salim',
  directorTitle: 'Direktur Utama',
  accountantName: 'Mazmur Gusti Agung L',
  accountantTitle: 'Direktur Keuangan',
  approverName: 'Sudono Salim',
  approverTitle: 'Direktur Utama',
  preparerName: 'Mazmur Gusti Agung L',
  preparerTitle: 'Direktur Keuangan',
  loginBgImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1920&auto=format&fit=crop',
  loginQuote: 'Driving sustainable energy excellence through decisive leadership, asset intelligence, and synchronized executive oversight.',
  loginOverlayDarkness: 'dark',
  bootingBgImage: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=1920&auto=format&fit=crop',
  bootingOverlayDarkness: 'dark',
  bootingBgPosX: 50,
  bootingBgPosY: 50,
  bootingBgZoom: 100,
  dashboardHeaderBgImage: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=1920&auto=format&fit=crop',
  dashboardHeaderOverlayDarkness: 'dark',
  dashboardHeaderBgPosX: 50,
  dashboardHeaderBgPosY: 50,
  dashboardHeaderBgZoom: 100,
  loginLogoUrl: './assets/NBE_white.png',
  loginLogoHeight: 48,
  loginBgPosX: 50,
  loginBgPosY: 50,
  loginBgZoom: 100
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
  { code: '10001', name: 'Kas', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '10002', name: 'Persediaan Barang Dagang', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '10003', name: 'Piutang Usaha', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
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

  { code: '20000', name: 'Utang / Kewajiban Lancar', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '20001', name: 'Utang Usaha/Dagang', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '20002', name: 'Utang Wesel', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '20003', name: 'Utang Gaji', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '20004', name: 'Utang Pajak Penghasilan', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '20005', name: 'Utang Hipotek', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '20006', name: 'Utang Obligasi', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '20007', name: 'Pendapatan Diterima Dimuka', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '20008', name: 'Utang Utilitas', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },

  { code: '21000', name: 'Utang Non Operasional', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '21001', name: 'Utang Sewa', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '21002', name: 'Utang Bank', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '21003', name: 'Utang Bunga', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },

  { code: '30000', name: 'Modal/Ekuitas', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '30001', name: 'Prive', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '30002', name: 'Ikhtisar Laba Rugi', pos: 'Nrc', sn: 'Db', debetAwal: 0, kreditAwal: 0 },

  { code: '40000', name: 'Pendapatan Operasional', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40001', name: 'Pendapatan Jasa / Usaha', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40002', name: 'Retur Penjualan', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40003', name: 'Potongan Penjualan', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40004', name: 'Pembelian', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40005', name: 'Retur Pembelian', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40006', name: 'Beban Angkut Pembelian', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40007', name: 'IRL', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '40008', name: 'Potongan Pembelian', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },

  { code: '41000', name: 'Pendapatan Non Operasional', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
  { code: '41001', name: 'Pendapatan Bunga', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },

  { code: '50000', name: 'Beban Operasional', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
  { code: '50001', name: 'Beban Gaji Toko', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 },
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

export const defaultTransactions: Transaction[] = [];
