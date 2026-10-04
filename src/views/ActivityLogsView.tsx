import React, { useState } from 'react';
import { Activity, Search, Download, ShieldCheck } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';

export const ActivityLogsView: React.FC = () => {
  const { activityLogs } = useAccounting();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = activityLogs.filter(log => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.username.toLowerCase().includes(q) ||
      log.fullName.toLowerCase().includes(q) ||
      log.position.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.detail.toLowerCase().includes(q) ||
      log.timestamp.toLowerCase().includes(q)
    );
  });

  const exportCSV = () => {
    if (activityLogs.length === 0) {
      alert('Tidak ada log untuk diekspor!');
      return;
    }
    const headers = ['ID', 'Waktu', 'Username', 'Nama Lengkap', 'Jabatan', 'Aksi', 'Rincian'];
    const rows = activityLogs.map(l => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.username}"`,
      `"${l.fullName}"`,
      `"${l.position}"`,
      `"${l.action}"`,
      `"${l.detail.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SPECTRA_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-5 space-y-4 animate-fadeIn max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl shadow-xs border border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-lg">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <span>Log Aktivitas Pengguna (Audit Trail)</span>
              <span className="text-[10px] bg-sky-100 text-sky-800 font-mono px-2 py-0.5 rounded font-bold">
                Akses Terproteksi
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Rekaman jejak digital seluruh kegiatan pencatatan jurnal, akun, perubahan PIN, dan autentikasi.
            </p>
          </div>
        </div>

        <button 
          type="button"
          onClick={exportCSV}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1.5 border border-slate-700 transition cursor-pointer shadow-xs"
        >
          <Download className="w-4 h-4 text-sky-400" />
          <span>Ekspor Log ke CSV</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Search Bar */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari aktivitas, nama pengguna, aksi, atau tanggal..."
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total Log: {filteredLogs.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table-accurate text-xs">
            <thead>
              <tr>
                <th className="w-36">Tanggal & Waktu</th>
                <th className="w-32">Pengguna</th>
                <th className="w-36">Jabatan</th>
                <th className="w-36">Aksi</th>
                <th>Rincian Kegiatan</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-xs text-slate-400">
                    Tidak ada aktivitas yang sesuai dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  let badgeColor = 'bg-slate-100 text-slate-700';
                  if (log.action.includes('RESET')) badgeColor = 'bg-rose-100 text-rose-800 font-bold';
                  else if (log.action.includes('Login')) badgeColor = 'bg-emerald-100 text-emerald-800';
                  else if (log.action.includes('Jurnal')) badgeColor = 'bg-blue-100 text-blue-800';
                  else if (log.action.includes('Akun')) badgeColor = 'bg-purple-100 text-purple-800';
                  else if (log.action.includes('PIN')) badgeColor = 'bg-amber-100 text-amber-800';

                  return (
                    <tr key={log.id}>
                      <td className="font-mono text-slate-600 text-[11px] whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="font-semibold text-slate-900">
                        {log.fullName} <span className="font-mono text-[10px] text-slate-400">(@{log.username})</span>
                      </td>
                      <td className="text-slate-600 text-[11px]">
                        {log.position}
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-[10px] ${badgeColor}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="text-slate-800 font-medium">
                        {log.detail}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
