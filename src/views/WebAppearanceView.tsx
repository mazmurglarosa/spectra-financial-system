import React, { useState } from 'react';
import { 
  Palette, 
  Upload, 
  Link as LinkIcon, 
  Check, 
  RotateCcw, 
  Eye, 
  Sparkles, 
  Image as ImageIcon, 
  Sliders, 
  Quote, 
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';

export interface ImagePreset {
  id: string;
  title: string;
  category: string;
  url: string;
  thumb: string;
}

export const PRESET_BACKGROUNDS: ImagePreset[] = [
  {
    id: 'refinery-nbe',
    title: 'Kilang Minyak & Fasilitas Industri (Default NBE)',
    category: 'Oil & Gas Facility',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'offshore-rig',
    title: 'Platform Eksplorasi Lepas Pantai (Offshore Rig)',
    category: 'Marine Exploration',
    url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'smart-grid',
    title: 'Pusat Kendali Eksekutif & Smart Grid Automation',
    category: 'Control Operations',
    url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'green-energy',
    title: 'Infrastruktur Energi Bersih & Turbin Terbarukan',
    category: 'Sustainable Energy',
    url: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'night-refinery',
    title: 'Kilang Industri Malam Hari (Atmospheric Night Glow)',
    category: 'Industrial Glow',
    url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=300&auto=format&fit=crop'
  }
];

export interface WebAppearanceViewProps {
  embedded?: boolean;
}

export const WebAppearanceView: React.FC<WebAppearanceViewProps> = ({ embedded = false }) => {
  const { settings, updateSettings, logActivity } = useAccounting();

  const [bgImageUrl, setBgImageUrl] = useState<string>(
    settings.loginBgImage || PRESET_BACKGROUNDS[0].url
  );
  const [quote, setQuote] = useState<string>(
    settings.loginQuote || 'Driving sustainable energy excellence through decisive leadership, asset intelligence, and synchronized executive oversight.'
  );
  const [subtitle, setSubtitle] = useState<string>(
    settings.loginSubtitle || 'Please enter your corporate credentials to access the executive portal.'
  );
  const [darkness, setDarkness] = useState<'dark' | 'medium' | 'light'>(
    settings.loginOverlayDarkness || 'dark'
  );

  const [isSaved, setIsSaved] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran file maksimal 5MB. Silakan pilih gambar lain yang lebih optimal.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (result) {
          setBgImageUrl(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save changes to settings
  const handleSave = () => {
    updateSettings({
      loginBgImage: bgImageUrl,
      loginQuote: quote,
      loginSubtitle: subtitle,
      loginOverlayDarkness: darkness
    });

    logActivity(
      'Pengaturan Tampilan',
      'Administrator memperbarui konfigurasi background dan estetika halaman login'
    );

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Reset to default
  const handleReset = () => {
    if (confirm('Kembalikan background dan teks halaman login ke pengaturan standar pabrik?')) {
      const defaultBg = PRESET_BACKGROUNDS[0].url;
      const defaultQuote = 'Driving sustainable energy excellence through decisive leadership, asset intelligence, and synchronized executive oversight.';
      const defaultSubtitle = 'Please enter your corporate credentials to access the executive portal.';
      
      setBgImageUrl(defaultBg);
      setQuote(defaultQuote);
      setSubtitle(defaultSubtitle);
      setDarkness('dark');

      updateSettings({
        loginBgImage: defaultBg,
        loginQuote: defaultQuote,
        loginSubtitle: defaultSubtitle,
        loginOverlayDarkness: 'dark'
      });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  // Overlay classes based on darkness option
  const getOverlayClass = (level: 'dark' | 'medium' | 'light') => {
    switch (level) {
      case 'dark':
        return 'bg-gradient-to-t from-slate-950/95 via-slate-900/80 to-slate-950/90';
      case 'medium':
        return 'bg-gradient-to-t from-slate-950/85 via-slate-900/60 to-slate-950/75';
      case 'light':
        return 'bg-gradient-to-t from-slate-950/70 via-slate-900/40 to-slate-950/50';
      default:
        return 'bg-gradient-to-t from-slate-950/90 via-slate-900/70 to-slate-950/85';
    }
  };

  return (
    <div className={embedded ? "space-y-6 w-full animate-fadeIn" : "p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full animate-fadeIn"}>
      
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
              <Palette className="w-5 h-5" />
            </span>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Kontrol Tampilan Web & Background Login
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Kustomisasi foto latar belakang, quote korporat, dan estetika gerbang otorisasi login {settings.companyName || 'PT Nirwana Bhumi Energy'}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/90 shadow-xs flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <Eye className="w-3.5 h-3.5 text-purple-600" />
            <span>Pratinjau Login</span>
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Tersimpan!</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Success Banner */}
      {isSaved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Pengaturan tampilan berhasil diperbarui. Background login akan otomatis diterapkan ke seluruh sesi pengguna.</span>
        </div>
      )}

      {/* 3. Main Grid: Left is Form Controls, Right is Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Background Selector & Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card: Upload & Custom URL */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-600" />
                <span>Foto Latar Belakang Login</span>
              </h2>
              <span className="text-[10px] font-semibold text-slate-400">Rasio 16:9 disarankan</span>
            </div>

            {/* Upload Button */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                1. Unggah Foto dari Komputer
              </label>
              <div className="flex items-center gap-3">
                <label className="flex-1 border-2 border-dashed border-slate-200 hover:border-purple-400 hover:bg-purple-50/30 rounded-xl p-3 text-center cursor-pointer transition flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold text-slate-700">Pilih Berkas Foto (JPG, PNG, WebP)</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                </label>
              </div>
            </div>

            {/* Custom URL Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                2. Atau Masukkan Tautan (URL) Foto
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="url"
                    value={bgImageUrl}
                    onChange={(e) => setBgImageUrl(e.target.value)}
                    placeholder="https://example.com/foto-kilang.jpg"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500 focus:outline-none transition"
                  />
                </div>
                {bgImageUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(bgImageUrl, '_blank')}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                    title="Buka foto asli di tab baru"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Preset Gallery */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">
                  3. Pilihan Galeri Preset Industri & Energi
                </label>
                <span className="text-[10px] text-purple-600 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Koleksi HD
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {PRESET_BACKGROUNDS.map((preset) => {
                  const isSelected = bgImageUrl === preset.url;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setBgImageUrl(preset.url)}
                      className={`relative group rounded-xl overflow-hidden border-2 cursor-pointer transition-all aspect-video ${
                        isSelected 
                          ? 'border-purple-600 ring-2 ring-purple-100 shadow-sm' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <img 
                        src={preset.thumb} 
                        alt={preset.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-end p-1.5">
                        <span className="text-[9px] font-bold text-white truncate leading-tight">
                          {preset.category}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Card: Text & Overlay Customization */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Quote className="w-4 h-4 text-purple-600" />
                <span>Pesan Korporat & Teks Halaman Login</span>
              </h2>
            </div>

            {/* Slogan Quote */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Slogan Korporat (Tampil di Sisi Kiri Login)
              </label>
              <textarea
                rows={3}
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Tuliskan slogan perusahaan..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500 focus:outline-none transition leading-relaxed"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Keterangan Form (Tampil di Bawah Judul 'Welcome back')
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Please enter your corporate credentials to access the executive portal."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500 focus:outline-none transition"
              />
            </div>

            {/* Overlay Darkness Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tingkat Kegelapan Filter Foto (Agar Teks Mudah Terbaca)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'dark', label: 'Pekat (85% Dark)' },
                  { id: 'medium', label: 'Standar (70% Deep)' },
                  { id: 'light', label: 'Ringan (50% Subtle)' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDarkness(item.id as any)}
                    className={`py-2 px-2 text-xs font-semibold rounded-xl border text-center transition cursor-pointer ${
                      darkness === item.id
                        ? 'bg-purple-50 text-purple-700 border-purple-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-rose-50 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kembalikan ke Standar Pabrik</span>
              </button>
            </div>

          </div>

        </div>

        {/* Right Column: Live Scaled Interactive Preview (5 cols) */}
        <div className="lg:col-span-5 sticky top-20 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-purple-600" />
              Pratinjau Hasil Desain
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Live Interactive</span>
          </div>

          {/* Miniature Split Login View Representation */}
          <div className="w-full bg-white rounded-2xl border border-slate-300/80 shadow-md overflow-hidden flex flex-col sm:flex-row aspect-[16/10]">
            
            {/* Left Hero Side with Dynamic Background */}
            <div className="relative w-1/2 p-4 flex flex-col justify-between overflow-hidden bg-slate-950">
              <img 
                src={bgImageUrl} 
                alt="Background Preview" 
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className={`absolute inset-0 ${getOverlayClass(darkness)}`} />

              {/* Logo Top Left */}
              <div className="relative z-10 flex items-center gap-2">
                <img src="./assets/NBE_white.png" alt="Logo NBE" className="h-6 w-auto object-contain" />
                <div className="text-white text-[10px] font-black leading-tight">
                  <div>Nirwana Bhumi</div>
                  <div className="text-sky-400">Energy</div>
                </div>
              </div>

              {/* Slogan Quote Bottom Left */}
              <div className="relative z-10 text-white text-[9px] font-medium leading-relaxed opacity-95 pr-2">
                “{quote}”
              </div>
            </div>

            {/* Right Form Side Representation */}
            <div className="w-1/2 p-4 bg-white flex flex-col justify-center space-y-2.5">
              <div>
                <div className="text-xs font-black text-slate-900 leading-tight">Welcome back</div>
                <div className="text-[8px] text-slate-500 truncate leading-normal">{subtitle}</div>
              </div>

              <div className="space-y-1.5">
                <div>
                  <div className="text-[8px] font-semibold text-slate-700">Corporate ID or Email</div>
                  <div className="h-5 px-2 bg-blue-50/70 border border-blue-200/80 rounded-md text-[8px] text-slate-800 flex items-center font-mono">
                    mazmur.larosa
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-[8px]">
                    <span className="font-semibold text-slate-700">Password</span>
                    <span className="text-blue-600 font-medium">Forgot password?</span>
                  </div>
                  <div className="h-5 px-2 bg-blue-50/70 border border-blue-200/80 rounded-md text-[8px] text-slate-500 flex items-center tracking-widest font-mono">
                    ••••••••
                  </div>
                </div>

                <div className="h-6 bg-blue-600 rounded-md flex items-center justify-center text-white text-[9px] font-bold gap-1 shadow-xs">
                  <span>Sign In</span>
                  <span>↗</span>
                </div>
              </div>

              <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-md text-[7px] text-slate-500 leading-tight">
                ℹ️ First-time login? You can update your password in Account Settings.
              </div>
            </div>

          </div>

          <div className="p-3 bg-purple-50/80 border border-purple-200/70 rounded-xl text-[11px] text-purple-900 leading-relaxed">
            💡 <strong>Info Sistem:</strong> Foto yang Anda pilih akan langsung tersimpan ke sistem SPECTRA. Kapan pun pengguna atau pengawas log in ke portal eksekutif, mereka akan disambut dengan foto latar belakang dan quote di atas.
          </div>
        </div>

      </div>

      {/* 4. Full Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-5xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row min-h-[500px]">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setPreviewModalOpen(false)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white flex items-center justify-center transition cursor-pointer"
            >
              ✕
            </button>

            {/* Left Hero */}
            <div className="relative w-full lg:w-1/2 p-8 lg:p-12 flex flex-col justify-between bg-slate-950 overflow-hidden">
              <img 
                src={bgImageUrl} 
                alt="Background" 
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className={`absolute inset-0 ${getOverlayClass(darkness)}`} />

              <div className="relative z-10 flex items-center gap-3">
                <img src="./assets/NBE_white.png" alt="Logo NBE" className="h-10 w-auto object-contain" />
                <div className="text-white text-base font-black tracking-wide leading-tight">
                  <div>Nirwana Bhumi</div>
                  <div className="text-sky-400">Energy</div>
                </div>
              </div>

              <div className="relative z-10 text-white text-sm lg:text-base font-medium leading-relaxed max-w-md pt-12">
                “{quote}”
              </div>
            </div>

            {/* Right Form */}
            <div className="w-full lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center space-y-5 bg-white">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Welcome back</h2>
                <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Corporate ID or Email
                  </label>
                  <input
                    type="text"
                    disabled
                    value="mazmur.larosa"
                    className="w-full bg-blue-50/70 border border-blue-200/80 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold text-slate-700">Password</span>
                    <span className="text-blue-600 font-semibold cursor-pointer">Forgot password?</span>
                  </div>
                  <input
                    type="password"
                    disabled
                    value="••••••••••••"
                    className="w-full bg-blue-50/70 border border-blue-200/80 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono"
                  />
                </div>

                <button
                  type="button"
                  disabled
                  className="w-full bg-[#2563eb] text-white font-bold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-1.5"
                >
                  <span>Sign In</span>
                  <span>↗</span>
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-500 leading-relaxed">
                ℹ️ First-time login? You can update your password in <strong>Account Settings</strong> after signing in.
              </div>

              <div className="text-center text-[10px] text-slate-400">
                © 2026 PT Nirwana Bhumi Energy. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
