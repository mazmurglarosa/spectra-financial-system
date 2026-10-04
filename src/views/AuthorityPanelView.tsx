import React, { useState } from 'react';
import { AlertCircle, Send, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';

export const AuthorityPanelView: React.FC = () => {
  const { currentUser, submitComplaint, complaints } = useAccounting();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const myComplaints = complaints.filter(c => c.username === currentUser?.username);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      alert('Harap isi subjek dan rincian pesan keluhan!');
      return;
    }
    submitComplaint(subject.trim(), message.trim());
    setSubject('');
    setMessage('');
    alert('Keluhan/masukan Anda berhasil dikirim ke Administrator!');
  };

  return (
    <div className="p-5 space-y-5 animate-fadeIn max-w-4xl mx-auto pb-12">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-900 to-slate-900 text-white p-5 rounded-xl shadow-md border border-amber-800/50 flex items-center space-x-3.5">
        <div className="p-3 bg-amber-600 text-white rounded-xl shadow-lg border border-amber-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-black tracking-wide text-white flex items-center space-x-2">
            <span>PANEL KHUSUS OTORITAS</span>
            <span className="text-[10px] bg-amber-950 text-amber-300 font-mono px-2 py-0.5 rounded border border-amber-700">
              Akses Otoritas
            </span>
          </h2>
          <p className="text-xs text-amber-200/90 mt-0.5">
            Saluran komunikasi resmi pemegang hak otoritas untuk mengirim keluhan, masukan, dan evaluasi langsung ke Administrator.
          </p>
        </div>
      </div>

      {/* Form Input Keluhan */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <MessageSquare className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-sm text-slate-900">
            Form Penyampaian Keluhan / Masukan Resmi
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Subjek / Pokok Masalah
            </label>
            <input 
              type="text" 
              required
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Contoh: Kesalahan input nominal, permintaan penyesuaian akun, kendala jurnal..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Rincian Informasi / Penjelasan Keluhan
            </label>
            <textarea 
              required
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Jelaskan secara rinci permasalahan, nomor bukti transaksi yang terkait, atau usulan solusi..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button 
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-lg shadow-sm flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Kirimkan ke Administrator</span>
            </button>
          </div>
        </form>
      </div>

      {/* History of complaints */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3">
          Histori Keluhan yang Anda Ajukan
        </h3>

        {myComplaints.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Anda belum pernah mengirimkan keluhan atau masukan.
          </div>
        ) : (
          <div className="space-y-3">
            {myComplaints.map(c => (
              <div key={c.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-900">{c.subject}</span>
                    <div className="text-[11px] text-slate-400">Dikirim pada: {c.timestamp}</div>
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
                    <div className="font-bold text-[11px] text-emerald-800 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Tanggapan Administrator ({c.respondedAt}):</span>
                    </div>
                    <div>{c.response}</div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">
                    Keluhan Anda sedang dalam peninjauan oleh Administrator.
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
