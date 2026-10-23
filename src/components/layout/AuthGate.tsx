import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  ArrowUpRight, 
  Info, 
  ArrowLeft, 
  Check, 
  ShieldCheck 
} from 'lucide-react';
import { useAccounting, DEFAULT_SUPERADMIN } from '../../context/AccountingContext';
import { User } from '../../types/accounting';
import { PRESET_BACKGROUNDS } from '../../views/WebAppearanceView';

interface AuthGateProps {
  onAuthenticated: (user: User) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const { login, register, settings } = useAccounting();

  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('mazmur.larosa');
  const [password, setPassword] = useState('Ringgo5t@r');
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [regFullName, setRegFullName] = useState('');
  const [regPosition, setRegPosition] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSpecialCode, setRegSpecialCode] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Alerts
  const [alertInfo, setAlertInfo] = useState<{ message: string; type: 'error' | 'warning' | 'success' } | null>(null);

  // Transition screen state (5 seconds)
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionUser, setTransitionUser] = useState<User | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [progressWidth, setProgressWidth] = useState(0);

  // Background, quote, logo, and positioning from settings
  const bgImage = settings.loginBgImage || PRESET_BACKGROUNDS[0].url;
  const bootingBg = settings.bootingBgImage || 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=1920&auto=format&fit=crop';
  const loginQuote = settings.loginQuote || 'Driving sustainable energy excellence through decisive leadership, asset intelligence, and synchronized executive oversight.';
  const loginSubtitle = settings.loginSubtitle || 'Please enter your corporate credentials to access the executive portal.';
  const loginLogo = settings.loginLogoUrl || './assets/NBE_white.png';
  const logoHeight = settings.loginLogoHeight || 48;
  const bgPosX = settings.loginBgPosX ?? 50;
  const bgPosY = settings.loginBgPosY ?? 50;
  const bgZoom = settings.loginBgZoom ?? 100;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAlertInfo(null);

    const res = login(username, password);
    if (res.success && res.user) {
      startTransition(res.user);
    } else {
      setAlertInfo({
        message: res.message,
        type: res.isPending ? 'warning' : 'error'
      });
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAlertInfo(null);

    const res = register({
      fullName: regFullName,
      position: regPosition,
      username: regUsername,
      password: regPassword,
      specialCode: regSpecialCode || '-'
    });

    if (res.success) {
      setAlertInfo({
        message: res.message,
        type: 'warning'
      });
      // Clear inputs
      setRegFullName('');
      setRegPosition('');
      setRegUsername('');
      setRegPassword('');
      setRegSpecialCode('');
      setTimeout(() => {
        setAuthTab('login');
      }, 3500);
    } else {
      setAlertInfo({
        message: res.message,
        type: 'error'
      });
    }
  };

  const startTransition = (user: User) => {
    setTransitionUser(user);
    setIsTransitioning(true);
    setCountdown(5);
    setProgressWidth(0);

    let timeLeft = 50; // 50 x 100ms = 5.0 seconds
    const interval = setInterval(() => {
      timeLeft--;
      const progress = ((50 - timeLeft) / 50) * 100;
      setProgressWidth(progress);
      setCountdown(Math.ceil(timeLeft / 10));

      if (timeLeft <= 0) {
        clearInterval(interval);
        setIsTransitioning(false);
        onAuthenticated(user);
      }
    }, 100);
  };

  // 5-SECOND TRANSITION / BOOTING SCREEN
  if (isTransitioning && transitionUser) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 select-none overflow-hidden">
        {/* Booting Background Image (Different from login screen) */}
        {bootingBg && (
          <img 
            src={bootingBg} 
            alt="Booting Background" 
            className="absolute inset-0 w-full h-full object-cover object-center scale-105 filter blur-xs brightness-[0.35] transition-all duration-700" 
          />
        )}
        {/* Atmospheric Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-slate-950/90" />

        <div className="relative z-10 max-w-md w-full text-center space-y-6 animate-fadeIn">
          <div className="inline-flex p-3.5 bg-white/95 backdrop-blur-xs rounded-2xl shadow-2xl border-2 border-blue-500/50 animate-pulse">
            <img 
              src={loginLogo && !loginLogo.includes('_white') ? loginLogo : './assets/NBE.png'} 
              alt="Logo" 
              style={{ height: `${Math.max(48, Math.min(84, logoHeight + 16))}px`, width: 'auto' }}
              className="max-w-[200px] object-contain" 
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-wide">
              {transitionUser.fullName}
            </h2>
            <div className="h-1 w-16 bg-blue-500 mx-auto rounded-full"></div>
            <p className="text-lg font-bold text-emerald-400">
              Selamat Datang Kembali "{transitionUser.position}"
            </p>
            <p className="text-xs text-slate-300">
              Menyiapkan buku besar, neraca, dan lembar kerja akuntansi...
            </p>
          </div>

          {/* Progress bar 5 seconds */}
          <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden border border-slate-700/80 backdrop-blur-xs">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400 rounded-full transition-all duration-100 ease-linear"
              style={{ width: `${progressWidth}%` }}
            />
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Membuka SPECTRA dalam <span className="text-blue-400 font-bold">{countdown}</span> detik...
          </div>
        </div>
      </div>
    );
  }

  // Overlay opacity class
  const overlayClass = settings.loginOverlayDarkness === 'light'
    ? 'bg-gradient-to-t from-slate-950/75 via-slate-900/40 to-slate-950/50'
    : settings.loginOverlayDarkness === 'medium'
    ? 'bg-gradient-to-t from-slate-950/85 via-slate-900/60 to-slate-950/75'
    : 'bg-gradient-to-t from-[#020b18]/95 via-[#06203d]/70 to-[#04162a]/90';

  // AUTHENTICATION SCREEN: 65% BACKGROUND & 35% LOGIN PANEL RATIO
  return (
    <div className="fixed inset-0 z-50 flex flex-col lg:flex-row bg-white overflow-y-auto">
      
      {/* 1. Left Side: Corporate Hero Banner (65% width) */}
      <div className="relative w-full lg:w-[65%] min-h-[360px] lg:min-h-screen bg-slate-950 flex flex-col justify-between p-8 sm:p-12 lg:p-16 overflow-hidden">
        
        {/* Dynamic Background Photo with interactive framing & crop */}
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src={bgImage} 
            alt="Corporate Facility" 
            style={{
              objectPosition: `${bgPosX}% ${bgPosY}%`,
              transform: `scale(${bgZoom / 100})`,
              transformOrigin: `${bgPosX}% ${bgPosY}%`
            }}
            className="w-full h-full object-cover transition-all duration-300"
          />
        </div>
        
        {/* Deep Industrial Navy Overlay */}
        <div className={`absolute inset-0 ${overlayClass}`} />

        {/* Top Left: Logo & Company Name */}
        <div className="relative z-10 flex items-center gap-3">
          <img 
            src={loginLogo} 
            alt="Logo Perusahaan" 
            style={{ height: `${logoHeight}px`, width: 'auto' }}
            className="max-w-[220px] object-contain drop-shadow" 
          />
          <div className="text-white text-base sm:text-lg font-black tracking-wide leading-tight">
            <div>Nirwana Bhumi</div>
            <div className="text-sky-400 font-extrabold">Energy</div>
          </div>
        </div>

        {/* Bottom Left: Corporate Quote / Slogan */}
        <div className="relative z-10 max-w-xl space-y-3 pt-12">
          <p className="text-white text-sm sm:text-base lg:text-lg font-medium leading-relaxed opacity-95">
            “{loginQuote}”
          </p>
        </div>

      </div>

      {/* 2. Right Side: Clean White Login Form Screen (35% width) */}
      <div className="w-full lg:w-[35%] flex items-center justify-center p-6 sm:p-10 lg:p-12 bg-white min-h-[500px]">
        <div className="max-w-sm w-full space-y-6 animate-fadeIn">
          
          {/* Header Title */}
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {authTab === 'login' ? 'Welcome back' : 'Daftar Akun Baru'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              {authTab === 'login' 
                ? loginSubtitle 
                : 'Lengkapi formulir di bawah ini untuk mengajukan akses akun ke sistem SPECTRA.'}
            </p>
          </div>

          {/* Notification Banner */}
          {alertInfo && (
            <div className={`p-3.5 rounded-xl text-xs font-medium space-y-1 ${
              alertInfo.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : alertInfo.type === 'warning'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}>
              <span dangerouslySetInnerHTML={{ __html: alertInfo.message }} />
            </div>
          )}

          {/* LOGIN FORM */}
          {authTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              
              {/* Field 1: Corporate ID or Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Corporate ID or Email
                </label>
                <input 
                  type="text" 
                  required 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="mazmur.larosa" 
                  className="w-full bg-[#eef4ff] hover:bg-[#e7efff] focus:bg-white border border-blue-200/90 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all font-medium"
                />
              </div>

              {/* Field 2: Password */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    Password
                  </label>
                  <button 
                    type="button" 
                    onClick={() => alert("Untuk mereset password, silakan hubungi Direktur Utama atau Administrator sistem SPECTRA.")}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    required 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full bg-[#eef4ff] hover:bg-[#e7efff] focus:bg-white border border-blue-200/90 rounded-xl px-4 pr-12 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 focus:outline-none transition-all font-medium tracking-normal"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Sign In Button with Arrow Up Right Icon */}
              <button 
                type="submit" 
                className="w-full bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-sm py-3.5 rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              >
                <span>Sign In</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              {/* Info Box */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  First-time login? You can update your password in <strong className="text-slate-800 font-bold">Account Settings</strong> after signing in.
                </div>
              </div>

              {/* Quick Actions & Registration */}
              <div className="pt-2 border-t border-slate-100 flex flex-col items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => { setAuthTab('register'); setAlertInfo(null); }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  Belum memiliki akun? Daftar Akun Baru
                </button>
                <button 
                  type="button"
                  onClick={() => startTransition(DEFAULT_SUPERADMIN)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                >
                  Lewati Login (Masuk Langsung sebagai Administrator)
                </button>
              </div>

            </form>
          ) : (
            /* REGISTER FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  required 
                  value={regFullName}
                  onChange={e => setRegFullName(e.target.value)}
                  placeholder="Nama lengkap Anda..." 
                  className="w-full bg-[#eef4ff] border border-blue-200/90 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jabatan / Posisi</label>
                <input 
                  type="text" 
                  required 
                  value={regPosition}
                  onChange={e => setRegPosition(e.target.value)}
                  placeholder="Contoh: Manajer Operasional..." 
                  className="w-full bg-[#eef4ff] border border-blue-200/90 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Username Baru</label>
                <input 
                  type="text" 
                  required 
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  placeholder="Username unik..." 
                  className="w-full bg-[#eef4ff] border border-blue-200/90 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password Baru</label>
                <div className="relative">
                  <input 
                    type={showRegPassword ? 'text' : 'password'}
                    required 
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Minimal 6 karakter..." 
                    className="w-full bg-[#eef4ff] border border-blue-200/90 rounded-xl px-3.5 pr-10 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Spesial Otorisasi (Opsional)</label>
                <input 
                  type="text" 
                  value={regSpecialCode}
                  onChange={e => setRegSpecialCode(e.target.value)}
                  placeholder="Kosongkan jika staf biasa..." 
                  className="w-full bg-[#eef4ff] border border-blue-200/90 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none font-mono"
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Kirim Permohonan Akun</span>
              </button>

              <div className="text-center pt-2">
                <button 
                  type="button"
                  onClick={() => { setAuthTab('login'); setAlertInfo(null); }}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Halaman Masuk</span>
                </button>
              </div>
            </form>
          )}

          {/* Copyright Footer */}
          <div className="text-center text-[11px] text-slate-400 pt-3">
            © 2026 PT Nirwana Bhumi Energy. All rights reserved.
          </div>

        </div>
      </div>

    </div>
  );
};
