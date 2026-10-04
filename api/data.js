export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sampleAccounts = [
    { code: '10001', name: 'Kas', category: 'Harta Lancar', pos: 'Nrc', sn: 'Db', debetAwal: 100000, kreditAwal: 0 },
    { code: '10003', name: 'Piutang Usaha', category: 'Harta Lancar', pos: 'Nrc', sn: 'Db', debetAwal: 500000, kreditAwal: 0 },
    { code: '11001', name: 'Peralatan Kantor', category: 'Harta Tetap', pos: 'Nrc', sn: 'Db', debetAwal: 10000000, kreditAwal: 0 },
    { code: '20001', name: 'Utang Usaha', category: 'Utang Lancar', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 2000000 },
    { code: '30001', name: 'Modal Pemilik', category: 'Modal / Ekuitas', pos: 'Nrc', sn: 'Kr', debetAwal: 0, kreditAwal: 8600000 },
    { code: '40001', name: 'Pendapatan Jasa Foto & Video', category: 'Pendapatan Operasional', pos: 'Lr', sn: 'Kr', debetAwal: 0, kreditAwal: 0 },
    { code: '50001', name: 'Beban Gaji Karyawan', category: 'Beban Operasional', pos: 'Lr', sn: 'Db', debetAwal: 0, kreditAwal: 0 }
  ];

  const sampleTransactions = [
    {
      id: 'trx-api-001',
      date: '2026-10-01',
      refNumber: 'JU-2610-001',
      type: 'general',
      description: 'Penerimaan Piutang Pelanggan',
      totalDebit: 500000,
      totalCredit: 500000,
      lines: [
        { id: 'line-1', accountId: '10001', accountCode: '10001', accountName: 'Kas', debit: 500000, credit: 0 },
        { id: 'line-2', accountId: '10003', accountCode: '10003', accountName: 'Piutang Usaha', debit: 0, credit: 500000 }
      ]
    }
  ];

  res.status(200).json({
    success: true,
    company: {
      companyName: 'SPECTRA Financial System',
      fiscalPeriod: 'Oktober 2026',
      currency: 'IDR'
    },
    accounts: sampleAccounts,
    transactions: sampleTransactions,
    lastUpdated: new Date().toISOString()
  });
}
