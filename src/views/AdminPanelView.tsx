import React, { useState } from 'react';
import { 
  AlertTriangle, 
  UserCheck, 
  UserX, 
  Users, 
  ShieldCheck, 
  Key, 
  Eye, 
  EyeOff, 
  Activity, 
  MessageSquare, 
  Check, 
  Send 
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';

export const AdminPanelView: React.FC = () => {
  const { 
    users, 
    approveUser, 
    rejectUser, 
    deleteUser, 
    toggleAuthority, 
    changePin, 
    complaints, 
    respondComplaint 
  } = useAccounting();

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'active'>('all');
  const [showAllPasswords, setShowAllPasswords] = useState(false);

  // Change PIN fields
  const [currPin, setCurrPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinFeedback, setPinFeedback] = useState<{ message: string; isSuccess: boolean } | null>(null);

  // Complaint response state
  const [replyText, setReplyText] = useState<{ [id: string]: string }>({});

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status === 'active');
  const authorityUsers = users.filter(u => u.isAuthority);

  let filteredUsers = users;
  if (activeTab === 'pending') filteredUsers = pendingUsers;
  else if (activeTab === 'active') filteredUsers = activeUsers;

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      setPinFeedback({ message: 'Konfirmasi PIN Baru tidak sesuai/cocok!', isSuccess: false });
      return;
    }
    const res = changePin(currPin, newPin);
    setPinFeedback({ message: res.message, isSuccess: res.success });
    if (res.success) {
      setCurrPin('');
      setNewPin('');
      setConfirmPin('');
    }
  };

  const handleRespond = (complaintId: string) => {
    const text = replyText[complaintId];
    if (!text || !text.trim()) {
      alert('Tuliskan tanggapan terlebih dahulu!');
      return;
    }
    respondComplaint(complaintId, text.trim());
    setReplyText(prev => ({ ...prev, [complaintId]: '' }));
    alert('Tanggapan berhasil dikirim!');
  };

  return (
    <div className="p-5 space-y-5 animate-fadeIn max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-900 to-slate-900 text-white p-5 rounded-xl shadow-md border border-rose-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-rose-600 text-white rounded-xl shadow-lg border border-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-wide text-white flex items-center space-x-2">
              <span>PANEL KHUSUS ADMINISTRATOR</span>
              <span className="text-[10px] bg-rose-950 text-rose-300 font-mono px-2 py-0.5 rounded border border-rose-700">
                Level: Super Admin
              </span>
            </h2>
            <p className="text-xs text-rose-200/90 mt-0.5">
              Pusat persetujuan akun pengguna, pengaturan PIN keamanan otorisasi, dan evaluasi keluhan operasional.
            </p>
          </div>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Menunggu Persetujuan</div>
            <div className="text-2xl font-black text-amber-600 mt-1">{pendingUsers.length}</div>
            <div className="text-[10px] text-slate-400">Pengajuan akun baru</div>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Pengguna Aktif</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{activeUsers.length}</div>
            <div className="text-[10px] text-slate-400">Dapat login ke sistem</div>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Pemegang Hak Otoritas</div>
            <div className="text-2xl font-black text-blue-600 mt-1">{authorityUsers.length}</div>
            <div className="text-[10px] text-slate-400">Memiliki akses panel khusus</div>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Section 1: User Management */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Users className="w-4 h-4 text-rose-600" />
              <span>Daftar Permohonan & Pengguna Sistem</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Administrator berwenang mengaktifkan akun, menghapus akun, dan menentukan hak otoritas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button 
              type="button"
              onClick={() => setShowAllPasswords(!showAllPasswords)}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
            >
              {showAllPasswords ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5 text-amber-700" />}
              <span>{showAllPasswords ? 'Sembunyikan Semua Password' : 'Lihat Semua Password'}</span>
            </button>

            <div className="flex items-center space-x-1 bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
              <button 
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${activeTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Semua ({users.length})
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${activeTab === 'pending' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Pending ({pendingUsers.length})
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('active')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Aktif ({activeUsers.length})
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-accurate text-xs">
            <thead>
              <tr>
                <th>Username</th>
                <th>Password</th>
                <th>Nama Lengkap</th>
                <th>Jabatan</th>
                <th>Kode Khusus</th>
                <th>Status Akun</th>
                <th>Hak Otoritas</th>
                <th className="text-center w-36">Aksi Otoritas</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td className="font-mono font-bold text-blue-600">{u.username}</td>
                  <td className="font-mono">
                    {showAllPasswords ? u.password || '••••••••' : '••••••••'}
                  </td>
                  <td className="font-semibold text-slate-900">{u.fullName}</td>
                  <td className="text-slate-600">{u.position}</td>
                  <td className="font-mono text-slate-500">{u.specialCode || '-'}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.status === 'active' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {u.status === 'active' ? 'AKTIF' : 'PENDING'}
                    </span>
                  </td>
                  <td>
                    <button 
                      type="button"
                      disabled={u.role === 'admin'}
                      onClick={() => toggleAuthority(u.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                        u.isAuthority 
                          ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {u.isAuthority ? '⭐ OTORITAS' : 'STANDAR'}
                    </button>
                  </td>
                  <td className="text-center">
                    {u.role === 'admin' ? (
                      <span className="text-[10px] text-slate-400 font-mono">Master Superadmin</span>
                    ) : (
                      <div className="flex items-center justify-center space-x-1.5">
                        {u.status === 'pending' && (
                          <button 
                            type="button"
                            onClick={() => approveUser(u.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[10px] font-bold shadow-xs cursor-pointer"
                          >
                            Aktifkan
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => {
                            if (confirm(`Apakah Anda yakin ingin menghapus akun ${u.username}?`)) {
                              deleteUser(u.id);
                            }
                          }}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded text-[10px] font-bold cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Change Security PIN */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Key className="w-5 h-5 text-rose-600" />
          <h3 className="font-bold text-sm text-slate-900">
            Pengaturan PIN Keamanan Otorisasi RESET
          </h3>
        </div>

        <form onSubmit={handlePinSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs max-w-2xl">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">PIN Saat Ini</label>
            <input 
              type="password" 
              required 
              value={currPin}
              onChange={e => setCurrPin(e.target.value)}
              placeholder="PIN saat ini..." 
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-center"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">PIN Baru (min 4 digit)</label>
            <input 
              type="password" 
              required 
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              placeholder="PIN baru..." 
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-center"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Konfirmasi PIN Baru</label>
            <input 
              type="password" 
              required 
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              placeholder="Ulangi PIN baru..." 
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-center"
            />
          </div>

          <div className="sm:col-span-3 flex items-center justify-between pt-2">
            <div>
              {pinFeedback && (
                <span className={`font-semibold ${pinFeedback.isSuccess ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {pinFeedback.message}
                </span>
              )}
            </div>
            <button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded shadow-xs cursor-pointer"
            >
              Simpan PIN Baru
            </button>
          </div>
        </form>
      </div>

      {/* Section 3: Complaints Handling */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <MessageSquare className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-sm text-slate-900">
            Daftar Keluhan & Tanggapan Operasional
          </h3>
        </div>

        {complaints.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Belum ada keluhan atau masukan dari akun otoritas.
          </div>
        ) : (
          <div className="space-y-3">
            {complaints.map(c => (
              <div key={c.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-900">{c.subject}</span>
                    <div className="text-[11px] text-slate-500">
                      Oleh: <span className="font-semibold text-slate-700">{c.fullName}</span> ({c.position}) • {c.timestamp}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    c.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {c.status === 'resolved' ? 'DITANGGAPI' : 'MENUNGGU TANGGAPAN'}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200 text-slate-800">
                  {c.message}
                </div>

                {c.response ? (
                  <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                    <div className="font-bold text-[11px] text-emerald-800">
                      Tanggapan Administrator ({c.respondedAt}):
                    </div>
                    <div>{c.response}</div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 pt-1">
                    <input 
                      type="text" 
                      placeholder="Ketikkan tanggapan Anda untuk keluhan ini..." 
                      value={replyText[c.id] || ''}
                      onChange={e => setReplyText(prev => ({ ...prev, [c.id]: e.target.value }))}
                      className="flex-1 border border-slate-300 rounded px-2.5 py-1 text-xs bg-white"
                    />
                    <button 
                      type="button" 
                      onClick={() => handleRespond(c.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded text-xs flex items-center space-x-1 cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Kirim Tanggapan</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
