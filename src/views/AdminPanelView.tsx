import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  UserCheck, 
  Users, 
  ShieldCheck, 
  Key, 
  Eye, 
  EyeOff, 
  MessageSquare, 
  Check, 
  Send,
  Globe,
  Database,
  ExternalLink,
  Cloud,
  CheckCircle2,
  Server,
  Code,
  Save,
  RefreshCw,
  Upload,
  Download,
  Copy,
  Zap,
  Palette
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { ResetModal } from '../components/modals/ResetModal';
import { ApiIntegrationBanner } from '../components/common/ApiIntegrationBanner';
import { SUPABASE_SQL_SCHEMA } from '../constants/sqlSchema';
import { WebAppearanceView } from './WebAppearanceView';

export type AdminSubTab = 'cloud' | 'security' | 'users' | 'complaints' | 'appearance';

export interface AdminPanelViewProps {
  initialTab?: AdminSubTab;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({ initialTab = 'cloud' }) => {
  const { 
    users, 
    approveUser, 
    rejectUser, 
    deleteUser, 
    toggleAuthority, 
    changePin, 
    complaints, 
    respondComplaint,
    supabaseConfig,
    saveSupabaseSettings,
    testSupabase,
    syncToSupabase,
    syncFromSupabase
  } = useAccounting();

  // Primary subtab navigation (Defaults to initialTab or 'cloud')
  const [adminTab, setAdminTab] = useState<AdminSubTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setAdminTab(initialTab);
    }
  }, [initialTab]);

  // User management tab filter
  const [userTabFilter, setUserTabFilter] = useState<'all' | 'pending' | 'active'>('all');
  const [showAllPasswords, setShowAllPasswords] = useState(false);

  // Change PIN state
  const [currPin, setCurrPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinFeedback, setPinFeedback] = useState<{ message: string; isSuccess: boolean } | null>(null);

  // Reset modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Supabase Cloud State
  const [sbUrl, setSbUrl] = useState(supabaseConfig.url);
  const [sbKey, setSbKey] = useState(supabaseConfig.anonKey);
  const [sbStatusMsg, setSbStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [sbLoading, setSbLoading] = useState(false);
  const [showSqlSchema, setShowSqlSchema] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  useEffect(() => {
    setSbUrl(supabaseConfig.url);
    setSbKey(supabaseConfig.anonKey);
  }, [supabaseConfig]);

  // Complaint response state
  const [replyText, setReplyText] = useState<{ [id: string]: string }>({});

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status === 'active');
  const authorityUsers = users.filter(u => u.isAuthority);

  let filteredUsers = users;
  if (userTabFilter === 'pending') filteredUsers = pendingUsers;
  else if (userTabFilter === 'active') filteredUsers = activeUsers;

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

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseSettings(sbUrl, sbKey);
    setSbStatusMsg({ text: 'Konfigurasi Supabase berhasil disimpan!', isError: false });
    setTimeout(() => setSbStatusMsg(null), 4000);
  };

  const handleTestSupabase = async () => {
    setSbLoading(true);
    setSbStatusMsg(null);
    try {
      const res = await testSupabase();
      setSbStatusMsg({ text: res.message, isError: !res.success });
    } catch (err: any) {
      setSbStatusMsg({ text: err.message || 'Koneksi gagal', isError: true });
    } finally {
      setSbLoading(false);
    }
  };

  const handleSyncToSupabase = async () => {
    if (!confirm('Apakah Anda yakin ingin mengunggah (push) seluruh data akun & transaksi lokal ke database Supabase?')) {
      return;
    }
    setSbLoading(true);
    setSbStatusMsg(null);
    try {
      const res = await syncToSupabase();
      setSbStatusMsg({ text: res.message, isError: !res.success });
    } catch (err: any) {
      setSbStatusMsg({ text: err.message || 'Sinkronisasi gagal', isError: true });
    } finally {
      setSbLoading(false);
    }
  };

  const handleSyncFromSupabase = async () => {
    if (!confirm('Apakah Anda yakin ingin menarik data dari Supabase? Data lokal akan diperbarui.')) {
      return;
    }
    setSbLoading(true);
    setSbStatusMsg(null);
    try {
      const res = await syncFromSupabase();
      setSbStatusMsg({ text: res.message, isError: !res.success });
    } catch (err: any) {
      setSbStatusMsg({ text: err.message || 'Sinkronisasi gagal', isError: true });
    } finally {
      setSbLoading(false);
    }
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 3000);
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
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full animate-fadeIn pb-16">
      
      {/* Header Banner matching NBE Light Enterprise Style */}
      <div className="bg-white text-slate-800 p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900">Panel Khusus Administrator</h1>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-full">
                Level: Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Pusat kendali integrasi cloud, sinkronisasi database online Supabase, REST API eksternal, otorisasi pengguna, serta zona kritis RESET sistem PT Nirwana Bhumi Energi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Cloud Sync Active</span>
          </span>
        </div>
      </div>

      {/* Subtab Selection Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-xs sticky top-4 z-20">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setAdminTab('cloud')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              adminTab === 'cloud'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Cloud, Supabase &amp; REST API</span>
          </button>

          <button
            onClick={() => setAdminTab('security')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              adminTab === 'security'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Keamanan PIN &amp; Reset Sistem</span>
          </button>

          <button
            onClick={() => setAdminTab('users')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              adminTab === 'users'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Manajemen Pengguna ({users.length})</span>
          </button>

          <button
            onClick={() => setAdminTab('complaints')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              adminTab === 'complaints'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Keluhan Operasional ({complaints.length})</span>
          </button>

          <button
            onClick={() => setAdminTab('appearance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              adminTab === 'appearance'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Tampilan Web &amp; Login</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: CLOUD, SUPABASE & REST API (Matches User's Image) */}
      {/* ======================================================== */}
      {adminTab === 'cloud' && (
        <div className="space-y-6 animate-fadeIn">
          {/* REST API Integration Banner */}
          <ApiIntegrationBanner />

          {/* Cloud & Full Online Status Card */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-5 md:p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-sky-600" />
                <span>3. Status Akses Web Cloud Online (Full Online Production)</span>
              </span>
              <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                ● AKTIF 24 JAM ONLINE
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Vercel Main Card */}
              <div className="p-4 rounded-xl border-2 border-sky-400 bg-gradient-to-br from-sky-50/70 to-indigo-50/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-950 flex items-center space-x-1.5">
                    <Globe className="w-4 h-4 text-sky-600" />
                    <span>Website Resmi (Vercel Production)</span>
                  </span>
                  <span className="text-[10px] bg-sky-600 text-white font-bold px-2 py-0.5 rounded">Utama</span>
                </div>
                <div className="font-mono text-[11px] text-sky-900 font-bold bg-white p-2.5 rounded-lg border border-sky-200 select-all truncate shadow-inner">
                  https://spectra-financial-system.vercel.app
                </div>
                <p className="text-[11px] text-sky-900/80 leading-relaxed">
                  Website live global tanpa perlu menyalakan komputer lokal. Siap dibagikan dan diakses oleh staf, direksi, dan auditor kapan saja.
                </p>
                <div className="pt-1 flex items-center space-x-2">
                  <a 
                    href="https://spectra-financial-system.vercel.app" 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg shadow-xs flex items-center space-x-1"
                  >
                    <span>Buka Website Vercel</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('https://spectra-financial-system.vercel.app');
                      alert('Link Vercel berhasil disalin!');
                    }}
                    className="bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[11px] px-3 py-1.5 rounded-lg border border-slate-300 shadow-xs cursor-pointer"
                  >
                    Salin Link
                  </button>
                </div>
              </div>

              {/* Backup / Mirror Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <Cloud className="w-4 h-4 text-slate-600" />
                    <span>Akses Cadangan (GitHub Pages Mirror)</span>
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded">Mirror</span>
                </div>
                <div className="font-mono text-[11px] text-slate-800 font-bold bg-white p-2.5 rounded-lg border border-slate-200 select-all truncate shadow-inner">
                  https://mazmurglarosa.github.io/spectra-financial-system/
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Mirror cadangan otomatis dari repositori GitHub untuk keandalan ekstra dan failover instan.
                </p>
                <div className="pt-1 flex items-center space-x-2">
                  <a 
                    href="https://mazmurglarosa.github.io/spectra-financial-system/" 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-[#0a192f] hover:bg-[#11243e] text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg shadow-xs flex items-center space-x-1"
                  >
                    <span>Buka Mirror GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('https://mazmurglarosa.github.io/spectra-financial-system/');
                      alert('Link Mirror berhasil disalin!');
                    }}
                    className="bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[11px] px-3 py-1.5 rounded-lg border border-slate-300 shadow-xs cursor-pointer"
                  >
                    Salin Link
                  </button>
                </div>
              </div>
            </div>

            {/* Supabase Database Cloud Integration */}
            <div className="p-4 md:p-5 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white border-2 border-emerald-500 rounded-xl shadow-xs space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-emerald-950 flex items-center space-x-2 text-xs">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>Database Cloud Utama: SUPABASE (PostgreSQL Online)</span>
                </span>
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center space-x-1 ${
                    supabaseConfig.isConfigured 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {supabaseConfig.isConfigured ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Tersambung (Siap Sinkron)</span>
                      </>
                    ) : (
                      <span>Belum Dikonfigurasi</span>
                    )}
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono">
                    MCP Ready
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-emerald-900/80 leading-relaxed">
                Hubungkan SPECTRA langsung ke cluster PostgreSQL Supabase. Seluruh tabel pembukuan (<code>accounts</code>, <code>transactions</code>, <code>contacts</code>, <code>company_settings</code>, <code>activity_logs</code>) dapat disinkronkan dua arah secara online serta dapat dikelola langsung menggunakan <b>Model Context Protocol (MCP)</b>.
              </p>

              <form onSubmit={handleSaveSupabase} className="space-y-2.5 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Supabase Project URL:
                    </label>
                    <input 
                      type="url"
                      value={sbUrl}
                      onChange={e => setSbUrl(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Supabase Anon Public API Key:
                    </label>
                    <input 
                      type="password"
                      value={sbKey}
                      onChange={e => setSbKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                {sbStatusMsg && (
                  <div className={`p-2 rounded text-xs font-medium flex items-center space-x-1.5 ${
                    sbStatusMsg.isError ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    {sbStatusMsg.isError ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" /> : <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />}
                    <span>{sbStatusMsg.text}</span>
                  </div>
                )}

                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-emerald-100">
                  <div className="flex items-center space-x-2">
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3 py-1.5 rounded shadow-xs flex items-center space-x-1 cursor-pointer transition"
                    >
                      <Save className="w-3 h-3" />
                      <span>Simpan Kunci</span>
                    </button>
                    <button
                      type="button"
                      disabled={sbLoading || !sbUrl || !sbKey}
                      onClick={handleTestSupabase}
                      className="bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[11px] px-3 py-1.5 rounded border border-slate-300 shadow-xs flex items-center space-x-1 cursor-pointer disabled:opacity-50 transition"
                    >
                      <RefreshCw className={`w-3 h-3 ${sbLoading ? 'animate-spin' : ''}`} />
                      <span>Uji Koneksi</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={sbLoading || !supabaseConfig.isConfigured}
                      onClick={handleSyncToSupabase}
                      className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-[11px] px-3 py-1.5 rounded shadow-xs flex items-center space-x-1 cursor-pointer disabled:opacity-50 transition"
                      title="Upload semua data lokal ke tabel Supabase"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Push ke Supabase</span>
                    </button>

                    <button
                      type="button"
                      disabled={sbLoading || !supabaseConfig.isConfigured}
                      onClick={handleSyncFromSupabase}
                      className="bg-[#0a192f] hover:bg-[#11243e] text-white font-bold text-[11px] px-3 py-1.5 rounded shadow-xs flex items-center space-x-1 cursor-pointer disabled:opacity-50 transition"
                      title="Tarik data terbaru dari Supabase"
                    >
                      <Download className="w-3 h-3" />
                      <span>Pull dari Supabase</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowSqlSchema(true)}
                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-semibold text-[11px] px-2.5 py-1.5 rounded border border-emerald-300 shadow-xs flex items-center space-x-1 cursor-pointer transition"
                    >
                      <Code className="w-3 h-3 text-emerald-700" />
                      <span>Skema SQL</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* MCP Integration Explanatory Note */}
              <div className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono space-y-1">
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span className="flex items-center space-x-1.5">
                    <Server className="w-3.5 h-3.5" />
                    <span>Supabase Model Context Protocol (MCP) Server:</span>
                  </span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                    mcp_config.json
                  </span>
                </div>
                <p className="text-slate-400 leading-normal">
                  Server endpoint MCP resmi telah terdaftar di sistem: <code>https://mcp.supabase.com/mcp</code>. Untuk mengaktifkan otorisasi penuh AI Assistant melakukan query/migrasi SQL otomatis, tambahkan Personal Access Token (PAT) Anda di pengaturan MCP.
                </p>
              </div>
            </div>

            {/* Convex Database Cloud Integration */}
            <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-950 flex items-center space-x-1.5 text-xs">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span>Backend Alternatif: CONVEX CLOUD</span>
                </span>
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                  Schema Ready
                </span>
              </div>
              <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                Skema database cloud untuk tabel <code>accounts</code>, <code>transactions</code>, <code>settings</code>, <code>users</code>, <code>activityLogs</code>, <code>complaints</code>, dan <code>contacts</code> juga tersedia di cluster Convex.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SECURITY PIN & SYSTEM RESET (Matches User's Image)*/}
      {/* ======================================================== */}
      {adminTab === 'security' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Security PIN Change */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-5 md:p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
              <Key className="w-4 h-4 text-rose-600" />
              <span>4. Pengaturan PIN Keamanan Otorisasi RESET</span>
            </h3>

            <form onSubmit={handlePinSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs max-w-2xl">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">PIN Saat Ini</label>
                <input 
                  type="password" 
                  required 
                  value={currPin}
                  onChange={e => setCurrPin(e.target.value)}
                  placeholder="PIN saat ini (bawaan: 1234)" 
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-center bg-white focus:outline-none focus:border-sky-500"
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
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-center bg-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Konfirmasi PIN Baru</label>
                <input 
                  type="password" 
                  required 
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value)}
                  placeholder="Konfirmasi..." 
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono text-center bg-white focus:outline-none focus:border-sky-500"
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
                  className="bg-[#0a192f] hover:bg-[#11243e] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs cursor-pointer transition active:scale-95"
                >
                  Simpan PIN Baru
                </button>
              </div>
            </form>
          </div>

          {/* Danger Zone: PIN Protected RESET */}
          <div className="bg-rose-50/70 rounded-2xl shadow-xs border-2 border-rose-200 p-5 md:p-6 space-y-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h3 className="font-bold text-sm text-rose-900">
                5. Zona Kritis: RESET Pembukuan Periode Baru
              </h3>
            </div>
            <p className="text-xs text-rose-800 leading-relaxed">
              Tindakan ini akan <b>menghapus seluruh transaksi jurnal</b> (baik Jurnal Umum maupun Penyesuaian) dan me-nol-kan kembali seluruh nominal saldo akun perkiraan (Rp 0) untuk memulai pembukuan periode baru yang bersih. Tindakan ini dilindungi oleh PIN keamanan otorisasi.
            </p>
            <div>
              <button 
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center space-x-2 cursor-pointer transition active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>RESET SISTEM (DENGAN PROTEKSI PIN)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: USER MANAGEMENT & AUTHORITY                     */}
      {/* ======================================================== */}
      {adminTab === 'users' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Menunggu Persetujuan</div>
                <div className="text-2xl font-black text-amber-600 mt-1">{pendingUsers.length}</div>
                <div className="text-[10px] text-slate-400">Pengajuan akun baru</div>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Pengguna Aktif</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">{activeUsers.length}</div>
                <div className="text-[10px] text-slate-400">Dapat login ke sistem</div>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Pemegang Hak Otoritas</div>
                <div className="text-2xl font-black text-[#0284c7] mt-1">{authorityUsers.length}</div>
                <div className="text-[10px] text-slate-400">Memiliki akses panel khusus</div>
              </div>
              <div className="p-3 bg-sky-50 text-[#0284c7] rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* User Management Table */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/70">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-sky-600" />
                  <span>Daftar Permohonan &amp; Pengguna Sistem</span>
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
                    onClick={() => setUserTabFilter('all')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${userTabFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Semua ({users.length})
                  </button>
                  <button 
                    type="button"
                    onClick={() => setUserTabFilter('pending')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${userTabFilter === 'pending' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Pending ({pendingUsers.length})
                  </button>
                  <button 
                    type="button"
                    onClick={() => setUserTabFilter('active')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${userTabFilter === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
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
                      <td className="font-mono font-bold text-sky-700">{u.username}</td>
                      <td className="font-mono text-slate-600">
                        {showAllPasswords ? (
                          <span className="bg-amber-50 px-1 py-0.5 rounded border border-amber-200 font-bold text-slate-800">
                            {u.password || '-'}
                          </span>
                        ) : (
                          '••••••••'
                        )}
                      </td>
                      <td className="font-medium text-slate-900">{u.fullName}</td>
                      <td className="text-slate-600">{u.position}</td>
                      <td className="font-mono text-xs">{u.specialCode || '-'}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.status === 'active' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : u.status === 'pending' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {u.status === 'active' ? 'Aktif' : u.status === 'pending' ? 'Pending' : 'Ditolak'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => toggleAuthority(u.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                            u.isAuthority 
                              ? 'bg-sky-100 text-sky-800 border border-sky-300' 
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {u.isAuthority ? 'Otoritas ON' : 'Otoritas OFF'}
                        </button>
                      </td>
                      <td className="text-center space-x-1">
                        {u.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => approveUser(u.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                          >
                            Setujui
                          </button>
                        )}
                        {u.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => rejectUser(u.id)}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                          >
                            Tolak
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Hapus pengguna ${u.username}?`)) {
                              deleteUser(u.id);
                            }
                          }}
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-bold px-1.5 py-0.5 cursor-pointer"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-6 text-slate-400">
                        Tidak ada data pengguna dalam filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: COMPLAINTS & FEEDBACK                             */}
      {/* ======================================================== */}
      {adminTab === 'complaints' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-5 md:p-6 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <MessageSquare className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-sm text-slate-900">
                Daftar Keluhan &amp; Tanggapan Operasional
              </h3>
            </div>

            {complaints.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Belum ada keluhan atau masukan dari akun staf/otoritas.
              </div>
            ) : (
              <div className="space-y-3">
                {complaints.map(c => (
                  <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{c.subject}</span>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Oleh: <span className="font-semibold text-slate-700">{c.fullName}</span> ({c.position}) • {c.timestamp}
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {c.status === 'resolved' ? 'DITANGGAPI' : 'MENUNGGU TANGGAPAN'}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-800 leading-relaxed">
                      {c.message}
                    </div>

                    {c.response ? (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
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
                          className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-sky-500"
                        />
                        <button 
                          type="button" 
                          onClick={() => handleRespond(c.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center space-x-1 cursor-pointer transition active:scale-95"
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
      )}

      {/* ======================================================== */}
      {/* TAB 5: TAMPILAN WEB & BACKGROUND LOGIN */}
      {/* ======================================================== */}
      {adminTab === 'appearance' && (
        <div className="space-y-6 animate-fadeIn">
          <WebAppearanceView embedded />
        </div>
      )}

      {/* SQL Schema Preview Modal */}
      {showSqlSchema && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
            <div className="p-4 bg-[#0a192f] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm">Skema Database Supabase PostgreSQL</span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowSqlSchema(false)} 
                className="text-white/80 hover:text-white text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 space-y-1 shrink-0">
              <p>
                Salin skema SQL di bawah ini dan jalankan pada <b>SQL Editor</b> di dashboard Supabase Anda (<code>https://supabase.com/dashboard/project/_/sql</code>) untuk membuat tabel <code>accounts</code>, <code>transactions</code>, <code>contacts</code>, <code>company_settings</code>, dan <code>activity_logs</code>.
              </p>
            </div>

            <div className="p-4 overflow-y-auto flex-1 font-mono text-[11px] bg-slate-900 text-emerald-400 select-all leading-relaxed whitespace-pre">
              {SUPABASE_SQL_SCHEMA}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-600">
                {copiedSchema ? '✓ Skema berhasil disalin ke clipboard!' : 'File tersimpan juga di supabase/schema.sql'}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopySchema}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Semua SQL</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSqlSchema(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Reset Protected Modal */}
      <ResetModal 
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
      />
    </div>
  );
};
