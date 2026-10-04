import React, { useState, useEffect } from 'react';
import { User as UserIcon, Lock, Eye, EyeOff, LogIn, UserPlus, ArrowLeft } from 'lucide-react';
import { useAccounting, DEFAULT_SUPERADMIN } from '../../context/AccountingContext';
import { User } from '../../types/accounting';

interface AuthGateProps {
  onAuthenticated: (user: User) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const { login, register } = useAccounting();

  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('admin');
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

  // Transition screen state (4 seconds)
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionUser, setTransitionUser] = useState<User | null>(null);
  const [countdown, setCountdown] = useState(4);
  const [progressWidth, setProgressWidth] = useState(0);

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
    setCountdown(4);
    setProgressWidth(0);

    let timeLeft = 40; // 40 x 100ms = 4.0 seconds
    const interval = setInterval(() => {
      timeLeft--;
      const progress = ((40 - timeLeft) / 40) * 100;
      setProgressWidth(progress);
      setCountdown(Math.ceil(timeLeft / 10));

      if (timeLeft <= 0) {
        clearInterval(interval);
        setIsTransitioning(false);
        onAuthenticated(user);
      }
    }, 100);
  };

  // 4-SECOND TRANSITION SCREEN
  if (isTransitioning && transitionUser) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 select-none">
        <div className="max-w-md w-full text-center space-y-6 animate-fadeIn">
          <div className="inline-flex p-3.5 bg-white rounded-2xl shadow-2xl border-2 border-blue-500/50 animate-pulse">
            <img src="./assets/NBE.png" alt="Logo NBE" className="h-16 w-auto object-contain" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-wide">
              {transitionUser.fullName}
            </h2>
            <div className="h-1 w-16 bg-blue-500 mx-auto rounded-full"></div>
            <p className="text-lg font-bold text-emerald-400">
              Selamat Datang Kembali "{transitionUser.position}"
            </p>
            <p className="text-xs text-slate-400">
              Menyiapkan buku besar, neraca, dan lembar kerja akuntansi...
            </p>
          </div>

          {/* Progress bar 4 seconds */}
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-100 ease-linear"
              style={{ width: `${progressWidth}%` }}
            />
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            Membuka SPECTRA dalam <span className="text-blue-400 font-bold">{countdown}</span> detik...
          </div>
        </div>
      </div>
    );
  }

  // AUTHENTICATION SCREEN (LOGIN & REGISTER)
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 sm:p-8 space-y-5 animate-fadeIn">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-2.5 bg-white rounded-xl shadow-lg border border-slate-700/60 mb-1">
            <img src="./assets/NBE.png" alt="Logo NBE" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-xl font-black text-white tracking-wider">SPECTRA</h1>
          <p className="text-xs text-slate-400">Sistem Pencatatan dan Evaluasi Keuangan Terpadu & Akurat</p>
          <div className="inline-block text-[11px] font-mono text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded border border-blue-900">
            Gerbang Otorisasi Pengguna
          </div>
        </div>

        {/* Notification Banner */}
        {alertInfo && (
          <div className={`p-3 rounded-lg text-xs font-medium space-y-1 ${
            alertInfo.type === 'error'
              ? 'bg-rose-950/90 text-rose-300 border border-rose-800'
              : alertInfo.type === 'warning'
              ? 'bg-amber-950/90 text-amber-300 border border-amber-800'
              : 'bg-emerald-950/90 text-emerald-300 border border-emerald-800'
          }`}>
            <span dangerouslySetInnerHTML={{ __html: alertInfo.message }} />
          </div>
        )}

        {/* LOGIN FORM */}
        {authTab === 'login' ? (
          <div className="space-y-4">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nama Akun (Username)
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input 
                    type="text" 
                    required 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Masukkan nama akun..." 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password Akun
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    required 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Masukkan password..." 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk ke SPECTRA</span>
              </button>
            </form>

            <div className="pt-3 border-t border-slate-800 text-center space-y-2">
              <p className="text-xs text-slate-400">Belum memiliki akun terdaftar?</p>
              <button 
                type="button" 
                onClick={() => { setAuthTab('register'); setAlertInfo(null); }}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 transition cursor-pointer"
              >
                Daftar Akun Baru di Sini &rarr;
              </button>
              <div>
                <button 
                  type="button"
                  onClick={() => startTransition(DEFAULT_SUPERADMIN)}
                  className="text-[11px] text-slate-500 hover:text-slate-300 underline mt-1"
                >
                  Lewati Login (Masuk Langsung sebagai Administrator)
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* REGISTER FORM */
          <div className="space-y-3 text-xs">
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">1. Nama Lengkap</label>
                <input 
                  type="text" 
                  required 
                  value={regFullName}
                  onChange={e => setRegFullName(e.target.value)}
                  placeholder="Nama lengkap Anda..." 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">2. Jabatan Lengkap</label>
                <input 
                  type="text" 
                  required 
                  value={regPosition}
                  onChange={e => setRegPosition(e.target.value)}
                  placeholder="Contoh: Direktur Keuangan, Staff Akuntansi, dll" 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">3. Nama Akun (Username)</label>
                <input 
                  type="text" 
                  required 
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  placeholder="Username unik untuk login..." 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">4. Password</label>
                <div className="relative">
                  <input 
                    type={showRegPassword ? 'text' : 'password'}
                    required 
                    minLength={4}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Password akun..." 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 pr-8 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                  >
                    {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">5. Kode Khusus</label>
                <input 
                  type="text" 
                  value={regSpecialCode}
                  onChange={e => setRegSpecialCode(e.target.value)}
                  placeholder="Kode verifikasi pendaftaran khusus..." 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition mt-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Ajukan Pendaftaran Akun</span>
              </button>
            </form>

            <div className="pt-3 border-t border-slate-800 text-center">
              <button 
                type="button" 
                onClick={() => { setAuthTab('login'); setAlertInfo(null); }}
                className="text-xs font-semibold text-slate-400 hover:text-white transition flex items-center justify-center space-x-1 mx-auto cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Halaman Masuk (Login)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
