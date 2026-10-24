import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  Move,
  ZoomIn,
  Play,
  Monitor,
  Maximize2
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { compressImage, compressPngLogo } from '../lib/imageCompressor';
import { CompanySettings } from '../types/accounting';

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

export const PRESET_BOOTING_BACKGROUNDS: ImagePreset[] = [
  {
    id: 'booting-night-flare',
    title: 'Kilang Malam Flare Atmosferik (Default Booting)',
    category: 'Night Operation',
    url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'booting-control-room',
    title: 'Ruang Kendali Otomasi SCADA (Operations Center)',
    category: 'Mission Control',
    url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'booting-deep-sea',
    title: 'Platform Lepas Pantai Laut Dalam (Offshore Platform)',
    category: 'Offshore Exploration',
    url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'booting-refinery-structure',
    title: 'Struktur Rangka Baja Kilang Energi (Industrial Steel Grid)',
    category: 'Structural Power',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300&auto=format&fit=crop'
  }
];

export interface WebAppearanceViewProps {
  embedded?: boolean;
}

export const WebAppearanceView: React.FC<WebAppearanceViewProps> = ({ embedded = false }) => {
  const { settings, updateSettings, logActivity } = useAccounting();

  // 1. Background login states
  const [bgImageUrl, setBgImageUrl] = useState<string>(
    settings.loginBgImage || PRESET_BACKGROUNDS[0].url
  );
  const [bgPosX, setBgPosX] = useState<number>(settings.loginBgPosX ?? 50);
  const [bgPosY, setBgPosY] = useState<number>(settings.loginBgPosY ?? 50);
  const [bgZoom, setBgZoom] = useState<number>(settings.loginBgZoom ?? 100);

  // 2. Background booting states
  const [bootingBgUrl, setBootingBgUrl] = useState<string>(
    settings.bootingBgImage || PRESET_BOOTING_BACKGROUNDS[0].url
  );
  const [bootingDarkness, setBootingDarkness] = useState<'dark' | 'medium' | 'light'>(
    settings.bootingOverlayDarkness || 'dark'
  );
  const [bootingBgPosX, setBootingBgPosX] = useState<number>(settings.bootingBgPosX ?? 50);
  const [bootingBgPosY, setBootingBgPosY] = useState<number>(settings.bootingBgPosY ?? 50);
  const [bootingBgZoom, setBootingBgZoom] = useState<number>(settings.bootingBgZoom ?? 100);

  // 3. Logo states
  const [logoUrl, setLogoUrl] = useState<string>(
    settings.loginLogoUrl || './assets/NBE_white.png'
  );
  const [logoHeight, setLogoHeight] = useState<number>(
    settings.loginLogoHeight || 48
  );

  // 4. Texts and overlay
  const [quote, setQuote] = useState<string>(
    settings.loginQuote || 'Driving sustainable energy excellence through decisive leadership, asset intelligence, and synchronized executive oversight.'
  );
  const [subtitle, setSubtitle] = useState<string>(
    settings.loginSubtitle || 'Please enter your corporate credentials to access the executive portal.'
  );
  const [darkness, setDarkness] = useState<'dark' | 'medium' | 'light'>(
    settings.loginOverlayDarkness || 'dark'
  );

  // Modals & Feedback
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBootingModalOpen, setPreviewBootingModalOpen] = useState(false);
  const [bootingSimTime, setBootingSimTime] = useState(5);
  const [bootingSimProgress, setBootingSimProgress] = useState(0);

  // Synchronize state when settings arrive from cloud
  useEffect(() => {
    if (settings.loginBgImage) setBgImageUrl(settings.loginBgImage);
    if (settings.loginBgPosX !== undefined) setBgPosX(settings.loginBgPosX);
    if (settings.loginBgPosY !== undefined) setBgPosY(settings.loginBgPosY);
    if (settings.loginBgZoom !== undefined) setBgZoom(settings.loginBgZoom);
    if (settings.bootingBgImage) setBootingBgUrl(settings.bootingBgImage);
    if (settings.bootingOverlayDarkness) setBootingDarkness(settings.bootingOverlayDarkness);
    if (settings.bootingBgPosX !== undefined) setBootingBgPosX(settings.bootingBgPosX);
    if (settings.bootingBgPosY !== undefined) setBootingBgPosY(settings.bootingBgPosY);
    if (settings.bootingBgZoom !== undefined) setBootingBgZoom(settings.bootingBgZoom);
    if (settings.loginLogoUrl) setLogoUrl(settings.loginLogoUrl);
    if (settings.loginLogoHeight) setLogoHeight(settings.loginLogoHeight);
    if (settings.loginQuote) setQuote(settings.loginQuote);
    if (settings.loginSubtitle) setSubtitle(settings.loginSubtitle);
    if (settings.loginOverlayDarkness) setDarkness(settings.loginOverlayDarkness);
  }, [settings]);

  // Helper for instant auto-save to Supabase & local state
  const autoSaveSettings = (partial: Partial<CompanySettings>, message = 'Pengaturan otomatis tersimpan ke Cloud!') => {
    updateSettings(partial);
    setSaveMessage(message);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3500);
  };

  // Upload handler for login background (With High-Definition Image Compression)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Ukuran file maksimal 15MB. Silakan pilih foto lain.');
      return;
    }

    try {
      setIsSaving(true);
      // Compress user photo into crisp web-optimized HD JPEG (1920x1080, ~150-250KB)
      // This prevents browser localStorage quota errors and syncs to Supabase in milliseconds!
      const compressed = await compressImage(file, 1920, 1080, 0.82);
      setBgImageUrl(compressed);
      autoSaveSettings({
        loginBgImage: compressed,
        loginBgPosX: bgPosX,
        loginBgPosY: bgPosY,
        loginBgZoom: bgZoom
      }, 'Foto background pribadi berhasil dioptimalkan dan otomatis tersimpan ke Cloud!');
      logActivity('Tampilan Web', 'Mengunggah & mengaktifkan foto background login pribadi (HD)');
    } catch (err: any) {
      alert('Gagal memproses gambar: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Upload handler for booting background
  const handleBootingFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Ukuran file maksimal 15MB. Silakan pilih gambar lain.');
      return;
    }

    try {
      setIsSaving(true);
      const compressed = await compressImage(file, 1920, 1080, 0.82);
      setBootingBgUrl(compressed);
      autoSaveSettings({ bootingBgImage: compressed }, 'Background booting berhasil dioptimalkan dan otomatis tersimpan!');
      logActivity('Tampilan Web', 'Memperbarui background booting sistem (HD)');
    } catch (err: any) {
      alert('Gagal memproses gambar booting: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Upload handler for Logo (PNG with transparency)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 6 * 1024 * 1024) {
      alert('Ukuran file logo maksimal 6MB.');
      return;
    }

    try {
      setIsSaving(true);
      const compressed = await compressPngLogo(file, 512, 256);
      setLogoUrl(compressed);
      autoSaveSettings({ loginLogoUrl: compressed, loginLogoHeight: logoHeight }, 'Logo transparan baru berhasil diunggah & tersimpan!');
      logActivity('Tampilan Web', 'Memperbarui logo perusahaan');
    } catch (err: any) {
      alert('Gagal memproses logo: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Preset selection with auto-save
  const handleSelectPreset = (url: string) => {
    setBgImageUrl(url);
    autoSaveSettings({
      loginBgImage: url,
      loginBgPosX: bgPosX,
      loginBgPosY: bgPosY,
      loginBgZoom: bgZoom
    }, 'Preset background aktif dan otomatis tersimpan!');
  };

  const handleSelectBootingPreset = (url: string) => {
    setBootingBgUrl(url);
    autoSaveSettings({ 
      bootingBgImage: url,
      bootingOverlayDarkness: bootingDarkness,
      bootingBgPosX,
      bootingBgPosY,
      bootingBgZoom
    }, 'Preset booting aktif dan otomatis tersimpan!');
  };

  // Manual save confirmation button
  const handleSave = () => {
    updateSettings({
      loginBgImage: bgImageUrl,
      loginBgPosX: bgPosX,
      loginBgPosY: bgPosY,
      loginBgZoom: bgZoom,
      bootingBgImage: bootingBgUrl,
      bootingOverlayDarkness: bootingDarkness,
      bootingBgPosX,
      bootingBgPosY,
      bootingBgZoom,
      loginLogoUrl: logoUrl,
      loginLogoHeight: logoHeight,
      loginQuote: quote,
      loginSubtitle: subtitle,
      loginOverlayDarkness: darkness
    });

    logActivity(
      'Pengaturan Tampilan',
      'Administrator memperbarui konfigurasi background login, background booting 5 detik, logo, serta posisi crop gambar.'
    );

    setSaveMessage('Seluruh konfigurasi tampilan berhasil tersimpan ke Cloud!');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Reset to default
  const handleReset = () => {
    if (confirm('Kembalikan background, posisi gambar, logo, dan teks ke pengaturan standar pabrik?')) {
      const defaultBg = PRESET_BACKGROUNDS[0].url;
      const defaultBootingBg = PRESET_BOOTING_BACKGROUNDS[0].url;
      const defaultLogo = './assets/NBE_white.png';
      const defaultQuote = 'Driving sustainable energy excellence through decisive leadership, asset intelligence, and synchronized executive oversight.';
      const defaultSubtitle = 'Please enter your corporate credentials to access the executive portal.';
      
      setBgImageUrl(defaultBg);
      setBgPosX(50);
      setBgPosY(50);
      setBgZoom(100);
      setBootingBgUrl(defaultBootingBg);
      setLogoUrl(defaultLogo);
      setLogoHeight(48);
      setQuote(defaultQuote);
      setSubtitle(defaultSubtitle);
      setDarkness('dark');
      setBootingDarkness('dark');
      setBootingBgPosX(50);
      setBootingBgPosY(50);
      setBootingBgZoom(100);

      updateSettings({
        loginBgImage: defaultBg,
        loginBgPosX: 50,
        loginBgPosY: 50,
        loginBgZoom: 100,
        bootingBgImage: defaultBootingBg,
        bootingOverlayDarkness: 'dark',
        bootingBgPosX: 50,
        bootingBgPosY: 50,
        bootingBgZoom: 100,
        loginLogoUrl: defaultLogo,
        loginLogoHeight: 48,
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

  // Run 5-second booting simulation
  const startBootingSimulation = () => {
    setPreviewBootingModalOpen(true);
    setBootingSimTime(5);
    setBootingSimProgress(0);

    let timeLeft = 50; // 50 x 100ms = 5.0s
    const interval = setInterval(() => {
      timeLeft--;
      const prog = ((50 - timeLeft) / 50) * 100;
      setBootingSimProgress(prog);
      setBootingSimTime(Math.ceil(timeLeft / 10));

      if (timeLeft <= 0) {
        clearInterval(interval);
      }
    }, 100);
  };

  return (
    <div className={embedded ? "space-y-6 w-full animate-fadeIn" : "p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full animate-fadeIn"}>
      
      {/* 1. Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
              <Palette className="w-5 h-5" />
            </span>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Kontrol Tampilan Web & Gerbang Otorisasi
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Kustomisasi foto latar belakang login (rasio 65:35), crop &amp; pergeseran posisi gambar, background layar booting 5 detik, serta logo korporat {settings.companyName || 'PT Nirwana Bhumi Energy'}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startBootingSimulation}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-emerald-600" />
            <span>Simulasi Booting (5s)</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-purple-600" />
            <span>Pratinjau Login (65:35)</span>
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
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

      {/* 2. Success Banner & Auto-Save Cloud Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-semibold text-slate-700">Auto-Save Cloud Aktif:</span>
          <span className="text-slate-500">Setiap perubahan foto pribadi, crop posisi, preset, dan logo langsung tersimpan permanen ke Cloud.</span>
        </div>
        {isSaved && (
          <div className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-fadeIn">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>{saveMessage || 'Pengaturan tersimpan ke Cloud!'}</span>
          </div>
        )}
        {isSaving && (
          <div className="flex items-center gap-1.5 text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 animate-fadeIn">
            <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
            <span>Mengompresi &amp; Menyimpan ke Cloud...</span>
          </div>
        )}
      </div>

      {/* 3. Main Grid: Left Form Controls (7 cols), Right Live Scaled Preview (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* ======================================================== */}
          {/* CARD 1: FOTO LATAR LOGIN & KONTROL POSISI / CROP */}
          {/* ======================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-600" />
                <span>1. Foto Background Halaman Login (Porsi 65%)</span>
              </h2>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Porsi Lebar: 65%
              </span>
            </div>

            {/* Upload Button */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Unggah Foto dari Komputer
              </label>
              <label className="flex border-2 border-dashed border-slate-200 hover:border-purple-400 hover:bg-purple-50/30 rounded-xl p-3 text-center cursor-pointer transition items-center justify-center gap-2">
                <Upload className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-semibold text-slate-700">Pilih Berkas Foto Login (JPG, PNG, WebP)</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* Custom URL Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Atau Masukkan Tautan (URL) Foto
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="url"
                    value={bgImageUrl}
                    onChange={(e) => setBgImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
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

            {/* ======================================================== */}
            {/* SUB-FEATURE: CROP & POSITION CONTROLS (User Request) */}
            {/* ======================================================== */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/90 space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-purple-600" />
                  <span>Penyelarasan Posisi &amp; Crop Gambar Background</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setBgPosX(50);
                    setBgPosY(50);
                    setBgZoom(100);
                  }}
                  className="text-[10px] text-slate-500 hover:text-purple-600 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Posisi</span>
                </button>
              </div>

              {/* Slider 1: Horizontal Position (X) */}
              <div>
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="font-semibold text-slate-600">Geser Kiri / Kanan (Horizontal X)</span>
                  <span className="font-mono text-purple-700 font-bold">{bgPosX}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">Kiri (0%)</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={bgPosX} 
                    onChange={e => setBgPosX(Number(e.target.value))}
                    onMouseUp={() => autoSaveSettings({ loginBgPosX: bgPosX, loginBgPosY: bgPosY, loginBgZoom: bgZoom }, 'Posisi horizontal background tersimpan!')}
                    onTouchEnd={() => autoSaveSettings({ loginBgPosX: bgPosX, loginBgPosY: bgPosY, loginBgZoom: bgZoom }, 'Posisi horizontal background tersimpan!')}
                    className="flex-1 accent-purple-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer" 
                  />
                  <span className="text-[10px] text-slate-400">Kanan (100%)</span>
                </div>
              </div>

              {/* Slider 2: Vertical Position (Y) */}
              <div>
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="font-semibold text-slate-600">Geser Atas / Bawah (Vertikal Y)</span>
                  <span className="font-mono text-purple-700 font-bold">{bgPosY}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">Atas (0%)</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={bgPosY} 
                    onChange={e => setBgPosY(Number(e.target.value))}
                    onMouseUp={() => autoSaveSettings({ loginBgPosX: bgPosX, loginBgPosY: bgPosY, loginBgZoom: bgZoom }, 'Posisi vertikal background tersimpan!')}
                    onTouchEnd={() => autoSaveSettings({ loginBgPosX: bgPosX, loginBgPosY: bgPosY, loginBgZoom: bgZoom }, 'Posisi vertikal background tersimpan!')}
                    className="flex-1 accent-purple-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer" 
                  />
                  <span className="text-[10px] text-slate-400">Bawah (100%)</span>
                </div>
              </div>

              {/* Slider 3: Zoom / Scale (Crop) */}
              <div>
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="font-semibold text-slate-600 flex items-center gap-1">
                    <ZoomIn className="w-3 h-3 text-purple-600" />
                    <span>Zoom / Crop Skala Gambar</span>
                  </span>
                  <span className="font-mono text-purple-700 font-bold">{bgZoom}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">100% (Normal)</span>
                  <input 
                    type="range" 
                    min="100" 
                    max="200" 
                    step="5"
                    value={bgZoom} 
                    onChange={e => setBgZoom(Number(e.target.value))}
                    onMouseUp={() => autoSaveSettings({ loginBgPosX: bgPosX, loginBgPosY: bgPosY, loginBgZoom: bgZoom }, 'Skala zoom background tersimpan!')}
                    onTouchEnd={() => autoSaveSettings({ loginBgPosX: bgPosX, loginBgPosY: bgPosY, loginBgZoom: bgZoom }, 'Skala zoom background tersimpan!')}
                    className="flex-1 accent-purple-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer" 
                  />
                  <span className="text-[10px] text-slate-400">200% (Dekat)</span>
                </div>
              </div>

              {/* 9-Point Alignment Quick Presets */}
              <div>
                <div className="text-[10px] font-semibold text-slate-500 mb-1.5">Preset Fokus Cepat (9 Titik):</div>
                <div className="grid grid-cols-3 gap-1.5 max-w-[260px]">
                  {[
                    { label: '↖ Kiri Atas', x: 0, y: 0 },
                    { label: '↑ Tengah Atas', x: 50, y: 0 },
                    { label: '↗ Kanan Atas', x: 100, y: 0 },
                    { label: '← Kiri Tengah', x: 0, y: 50 },
                    { label: '• Titik Pusat', x: 50, y: 50 },
                    { label: '→ Kanan Tengah', x: 100, y: 50 },
                    { label: '↙ Kiri Bawah', x: 0, y: 100 },
                    { label: '↓ Tengah Bawah', x: 50, y: 100 },
                    { label: '↘ Kanan Bawah', x: 100, y: 100 },
                  ].map((pt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setBgPosX(pt.x);
                        setBgPosY(pt.y);
                        autoSaveSettings({ loginBgPosX: pt.x, loginBgPosY: pt.y }, `Fokus ${pt.label} tersimpan!`);
                      }}
                      className={`text-[9px] font-semibold py-1 px-1.5 rounded-md border text-center transition cursor-pointer ${
                        bgPosX === pt.x && bgPosY === pt.y
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preset Gallery */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Pilihan Galeri Preset Industri &amp; Kilang Minyak
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
                      onClick={() => handleSelectPreset(preset.url)}
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

          {/* ======================================================== */}
          {/* CARD 2: FOTO BACKGROUND LAYAR BOOTING SISTEM (User Request) */}
          {/* ======================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-emerald-600" />
                <span>2. Foto Background Layar Booting Sistem (Durasi 5 Detik)</span>
              </h2>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <span>⏱ 5 Detik Loading</span>
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Foto ini akan ditampilkan di latar belakang saat transisi booting setelah tombol "Sign In" ditekan. Background ini dapat berbeda dari foto login utama.
            </p>

            {/* Upload Button Booting */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Unggah Foto Khusus Layar Booting
              </label>
              <label className="flex border-2 border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 rounded-xl p-3 text-center cursor-pointer transition items-center justify-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-slate-700">Pilih Berkas Foto Booting (JPG, PNG)</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleBootingFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* URL Input Booting */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Atau Tautan (URL) Foto Booting
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="url"
                    value={bootingBgUrl}
                    onChange={(e) => setBootingBgUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* Preset Gallery Booting */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Pilihan Preset Foto Atmosfer Booting:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PRESET_BOOTING_BACKGROUNDS.map((preset) => {
                  const isSelected = bootingBgUrl === preset.url;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectBootingPreset(preset.url)}
                      className={`relative group rounded-xl overflow-hidden border-2 cursor-pointer transition-all aspect-video ${
                        isSelected 
                          ? 'border-emerald-600 ring-2 ring-emerald-100 shadow-sm' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <img 
                        src={preset.thumb} 
                        alt={preset.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-end p-1.5">
                        <span className="text-[8px] font-bold text-white truncate leading-tight">
                          {preset.category}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tingkat Kegelapan Filter Foto Booting */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tingkat Kegelapan Filter Foto Booting (Agar Teks &amp; Logo Mudah Terbaca)
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
                    onClick={() => {
                      setBootingDarkness(item.id as any);
                      autoSaveSettings({ bootingOverlayDarkness: item.id as any }, `Filter booting ${item.label} aktif & tersimpan!`);
                    }}
                    className={`py-2 px-2 text-xs font-semibold rounded-xl border text-center transition cursor-pointer ${
                      bootingDarkness === item.id
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pengaturan Posisi & Crop Background Booting */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pengaturan Posisi &amp; Crop Background Booting</span>
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/60 px-2 py-0.5 rounded-md">
                  Auto-Save Aktif
                </span>
              </div>

              {/* Slider 1: Horizontal (X) */}
              <div>
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="font-semibold text-slate-600 flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-emerald-600" />
                    <span>Geser Horizontal (Kiri - Kanan)</span>
                  </span>
                  <span className="font-mono text-emerald-700 font-bold">{bootingBgPosX}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">Kiri (0%)</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={bootingBgPosX} 
                    onChange={e => setBootingBgPosX(Number(e.target.value))}
                    onMouseUp={() => autoSaveSettings({ bootingBgPosX, bootingBgPosY, bootingBgZoom }, 'Posisi horizontal booting tersimpan!')}
                    onTouchEnd={() => autoSaveSettings({ bootingBgPosX, bootingBgPosY, bootingBgZoom }, 'Posisi horizontal booting tersimpan!')}
                    className="flex-1 accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer" 
                  />
                  <span className="text-[10px] text-slate-400">Kanan (100%)</span>
                </div>
              </div>

              {/* Slider 2: Vertical (Y) */}
              <div>
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="font-semibold text-slate-600 flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-emerald-600" />
                    <span>Geser Vertikal (Atas - Bawah)</span>
                  </span>
                  <span className="font-mono text-emerald-700 font-bold">{bootingBgPosY}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">Atas (0%)</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={bootingBgPosY} 
                    onChange={e => setBootingBgPosY(Number(e.target.value))}
                    onMouseUp={() => autoSaveSettings({ bootingBgPosX, bootingBgPosY, bootingBgZoom }, 'Posisi vertikal booting tersimpan!')}
                    onTouchEnd={() => autoSaveSettings({ bootingBgPosX, bootingBgPosY, bootingBgZoom }, 'Posisi vertikal booting tersimpan!')}
                    className="flex-1 accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer" 
                  />
                  <span className="text-[10px] text-slate-400">Bawah (100%)</span>
                </div>
              </div>

              {/* Slider 3: Zoom / Scale */}
              <div>
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="font-semibold text-slate-600 flex items-center gap-1">
                    <ZoomIn className="w-3 h-3 text-emerald-600" />
                    <span>Zoom / Crop Skala Gambar Booting</span>
                  </span>
                  <span className="font-mono text-emerald-700 font-bold">{bootingBgZoom}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">100% (Normal)</span>
                  <input 
                    type="range" 
                    min="100" 
                    max="200" 
                    step="5"
                    value={bootingBgZoom} 
                    onChange={e => setBootingBgZoom(Number(e.target.value))}
                    onMouseUp={() => autoSaveSettings({ bootingBgPosX, bootingBgPosY, bootingBgZoom }, 'Skala zoom booting tersimpan!')}
                    onTouchEnd={() => autoSaveSettings({ bootingBgPosX, bootingBgPosY, bootingBgZoom }, 'Skala zoom booting tersimpan!')}
                    className="flex-1 accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer" 
                  />
                  <span className="text-[10px] text-slate-400">200% (Dekat)</span>
                </div>
              </div>

              {/* 9-Point Alignment Quick Presets */}
              <div>
                <div className="text-[10px] font-semibold text-slate-500 mb-1.5">Preset Fokus Cepat (9 Titik):</div>
                <div className="grid grid-cols-3 gap-1.5 max-w-[260px]">
                  {[
                    { label: '↖ Kiri Atas', x: 0, y: 0 },
                    { label: '↑ Tengah Atas', x: 50, y: 0 },
                    { label: '↗ Kanan Atas', x: 100, y: 0 },
                    { label: '← Kiri Tengah', x: 0, y: 50 },
                    { label: '• Titik Pusat', x: 50, y: 50 },
                    { label: '→ Kanan Tengah', x: 100, y: 50 },
                    { label: '↙ Kiri Bawah', x: 0, y: 100 },
                    { label: '↓ Tengah Bawah', x: 50, y: 100 },
                    { label: '↘ Kanan Bawah', x: 100, y: 100 },
                  ].map((pt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setBootingBgPosX(pt.x);
                        setBootingBgPosY(pt.y);
                        autoSaveSettings({ bootingBgPosX: pt.x, bootingBgPosY: pt.y }, `Fokus booting ${pt.label} tersimpan!`);
                      }}
                      className={`text-[9px] font-semibold py-1 px-1.5 rounded-md border text-center transition cursor-pointer ${
                        bootingBgPosX === pt.x && bootingBgPosY === pt.y
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Test Simulation Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={startBootingSimulation}
                className="w-full py-2 px-3 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-emerald-600" />
                <span>Uji Simulasi Layar Booting (5 Detik Countdown)</span>
              </button>
            </div>
          </div>

          {/* ======================================================== */}
          {/* CARD 3: GANTI LOGO & SESUAIKAN UKURAN (User Request) */}
          {/* ======================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>3. Logo Perusahaan di Halaman Login &amp; Booting</span>
              </h2>
              <span className="text-[10px] font-semibold text-slate-400">Mendukung format PNG</span>
            </div>

            {/* Upload Logo File */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Unggah Logo PNG (Disarankan Berlatar Transparan)
              </label>
              <label className="flex border-2 border-dashed border-slate-200 hover:border-sky-400 hover:bg-sky-50/30 rounded-xl p-3 text-center cursor-pointer transition items-center justify-center gap-2">
                <Upload className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-semibold text-slate-700">Pilih Berkas Logo PNG</span>
                <input 
                  type="file" 
                  accept="image/png,image/*" 
                  onChange={handleLogoUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* URL Input Logo */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Atau Tautan (URL) Logo PNG
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="./assets/NBE_white.png atau https://..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-none transition font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLogoUrl('./assets/NBE_white.png')}
                  className="px-2.5 py-2 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition font-medium cursor-pointer"
                  title="Kembalikan ke logo default NBE"
                >
                  Reset NBE
                </button>
              </div>
            </div>

            {/* Slider: Logo Height / Size */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-slate-700">Penyesuaian Ukuran Tinggi Logo</span>
                <span className="font-mono text-sky-700 font-bold">{logoHeight} px</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400">28px (Kecil)</span>
                <input 
                  type="range" 
                  min="28" 
                  max="96" 
                  step="2"
                  value={logoHeight} 
                  onChange={e => setLogoHeight(Number(e.target.value))}
                  className="flex-1 accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer" 
                />
                <span className="text-[10px] text-slate-400">96px (Besar)</span>
              </div>

              {/* Logo Preview Badge */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Pratinjau Logo Saat Ini:</span>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 flex items-center">
                  <img 
                    src={logoUrl} 
                    alt="Logo Preview" 
                    style={{ height: `${logoHeight}px`, width: 'auto' }}
                    className="max-w-[180px] object-contain drop-shadow" 
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ======================================================== */}
          {/* CARD 4: TEKS SLOGAN & TINGKAT KEGELAPAN OVERLAY */}
          {/* ======================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Quote className="w-4 h-4 text-purple-600" />
                <span>4. Pesan Korporat &amp; Intensitas Kegelapan Filter</span>
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
                Tingkat Kegelapan Filter Foto (Agar Teks &amp; Logo Mudah Terbaca)
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
              Pratinjau Hasil Desain (Rasio 65% : 35%)
            </span>
            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Live Real-time
            </span>
          </div>

          {/* Miniature Split Login View Representation: EXACT 65% : 35% */}
          <div className="w-full bg-white rounded-2xl border border-slate-300/80 shadow-md overflow-hidden flex flex-row aspect-[16/10]">
            
            {/* Left Hero Side with Dynamic Background & Exact Crop/Position (65%) */}
            <div className="relative w-[65%] p-3.5 flex flex-col justify-between overflow-hidden bg-slate-950">
              <div className="absolute inset-0 overflow-hidden">
                <img 
                  src={bgImageUrl} 
                  alt="Background Preview" 
                  style={{
                    objectPosition: `${bgPosX}% ${bgPosY}%`,
                    transform: `scale(${bgZoom / 100})`,
                    transformOrigin: `${bgPosX}% ${bgPosY}%`
                  }}
                  className="w-full h-full object-cover transition-all duration-300"
                />
              </div>
              <div className={`absolute inset-0 ${getOverlayClass(darkness)}`} />

              {/* Logo Top Left */}
              <div className="relative z-10 flex items-center">
                <img 
                  src={logoUrl} 
                  alt="Logo NBE" 
                  style={{ height: `${Math.max(18, Math.min(36, logoHeight * 0.55))}px`, width: 'auto' }}
                  className="object-contain drop-shadow" 
                />
              </div>

              {/* Slogan Quote Bottom Left */}
              <div className="relative z-10 text-white text-[8px] font-medium leading-relaxed opacity-95 pr-2">
                “{quote}”
              </div>
            </div>

            {/* Right Form Side Representation (35%) */}
            <div className="w-[35%] p-3 bg-white flex flex-col justify-center space-y-2 border-l border-slate-100">
              <div>
                <div className="text-[11px] font-black text-slate-900 leading-tight">Welcome back</div>
                <div className="text-[7px] text-slate-500 truncate leading-normal">{subtitle}</div>
              </div>

              <div className="space-y-1.5">
                <div>
                  <div className="text-[7px] font-semibold text-slate-700">Corporate ID or Email</div>
                  <div className="h-4 px-1.5 bg-blue-50/70 border border-blue-200/80 rounded text-[7px] text-slate-800 flex items-center font-mono">
                    mazmur.larosa
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-[7px]">
                    <span className="font-semibold text-slate-700">Password</span>
                    <span className="text-blue-600 font-medium">Forgot?</span>
                  </div>
                  <div className="h-4 px-1.5 bg-blue-50/70 border border-blue-200/80 rounded text-[7px] text-slate-500 flex items-center tracking-widest font-mono">
                    ••••••••
                  </div>
                </div>

                <div className="h-5 bg-blue-600 rounded flex items-center justify-center text-white text-[8px] font-bold gap-1 shadow-xs">
                  <span>Sign In</span>
                  <span>↗</span>
                </div>
              </div>

              <div className="p-1 bg-slate-50 border border-slate-100 rounded text-[6px] text-slate-500 leading-tight">
                ℹ️ First-time login? Update password in Account Settings.
              </div>
            </div>

          </div>

          {/* Quick Buttons below Preview */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              className="flex-1 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Buka Pratinjau Penuh (65:35)</span>
            </button>
            <button
              type="button"
              onClick={startBootingSimulation}
              className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Uji Booting (5s)</span>
            </button>
          </div>

          <div className="p-3 bg-purple-50/80 border border-purple-200/70 rounded-xl text-[11px] text-purple-900 leading-relaxed">
            💡 <strong>Rasio Desain:</strong> Halaman login menggunakan rasio <strong>65% latar belakang</strong> dan <strong>35% panel login</strong>. Posisi gambar, crop, dan ukuran logo yang Anda atur di atas otomatis disinkronkan ke seluruh sesi pengguna dan database Supabase Cloud.
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* MODAL 1: FULL PREVIEW LOGIN (65% : 35% EXACT RATIO) */}
      {/* ======================================================== */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-5xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row min-h-[520px]">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setPreviewModalOpen(false)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white flex items-center justify-center transition cursor-pointer"
            >
              ✕
            </button>

            {/* Left Hero (65% Width) */}
            <div className="relative w-full lg:w-[65%] p-8 lg:p-12 flex flex-col justify-between bg-slate-950 overflow-hidden min-h-[300px]">
              <div className="absolute inset-0 overflow-hidden">
                <img 
                  src={bgImageUrl} 
                  alt="Background" 
                  style={{
                    objectPosition: `${bgPosX}% ${bgPosY}%`,
                    transform: `scale(${bgZoom / 100})`,
                    transformOrigin: `${bgPosX}% ${bgPosY}%`
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className={`absolute inset-0 ${getOverlayClass(darkness)}`} />

              <div className="relative z-10 flex items-center">
                <img 
                  src={logoUrl} 
                  alt="Logo Perusahaan" 
                  style={{ height: `${logoHeight}px`, width: 'auto' }}
                  className="max-w-[220px] object-contain drop-shadow" 
                />
              </div>

              <div className="relative z-10 text-white text-sm lg:text-base font-medium leading-relaxed max-w-md pt-12">
                “{quote}”
              </div>
            </div>

            {/* Right Form (35% Width) */}
            <div className="w-full lg:w-[35%] p-8 flex flex-col justify-center space-y-5 bg-white border-l border-slate-100">
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
                  className="w-full bg-[#2563eb] text-white font-bold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-not-allowed"
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

      {/* ======================================================== */}
      {/* MODAL 2: INTERACTIVE 5-SECOND BOOTING SIMULATION MODAL */}
      {/* ======================================================== */}
      {previewBootingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 select-none overflow-hidden animate-fadeIn">
          {/* Close button for simulation */}
          <button
            type="button"
            onClick={() => setPreviewBootingModalOpen(false)}
            className="absolute top-6 right-6 z-30 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-semibold backdrop-blur-xs transition cursor-pointer"
          >
            ✕ Tutup Simulasi
          </button>

          {/* Booting Background Photo with custom crop & darkness filter */}
          {bootingBgUrl && (
            <div className="absolute inset-0 overflow-hidden">
              <img 
                src={bootingBgUrl} 
                alt="Booting Background Simulation" 
                style={{
                  objectPosition: `${bootingBgPosX}% ${bootingBgPosY}%`,
                  transform: `scale(${bootingBgZoom / 100})`,
                  transformOrigin: `${bootingBgPosX}% ${bootingBgPosY}%`
                }}
                className="w-full h-full object-cover transition-all duration-300" 
              />
            </div>
          )}

          {/* Atmospheric Dark Overlay based on bootingDarkness */}
          <div className={`absolute inset-0 ${getOverlayClass(bootingDarkness)}`} />

          <div className="relative z-10 max-w-md w-full text-center space-y-6 animate-fadeIn">
            {/* Logo with configured size */}
            <div className="inline-flex p-3.5 bg-white/95 backdrop-blur-xs rounded-2xl shadow-2xl border-2 border-blue-500/50 animate-pulse">
              <img 
                src={logoUrl && !logoUrl.includes('_white') ? logoUrl : './assets/NBE.png'} 
                alt="Logo NBE" 
                style={{ height: `${Math.max(48, Math.min(84, logoHeight + 16))}px`, width: 'auto' }}
                className="max-w-[200px] object-contain" 
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-wide">
                Administrator Sistem
              </h2>
              <div className="h-1 w-16 bg-blue-500 mx-auto rounded-full"></div>
              <p className="text-lg font-bold text-emerald-400">
                Selamat Datang Kembali "Super Admin"
              </p>
              <p className="text-xs text-slate-300">
                Menyiapkan buku besar, neraca, dan lembar kerja akuntansi...
              </p>
            </div>

            {/* Progress bar 5 seconds */}
            <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden border border-slate-700/80 backdrop-blur-xs">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400 rounded-full transition-all duration-100 ease-linear"
                style={{ width: `${bootingSimProgress}%` }}
              />
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              Membuka SPECTRA dalam <span className="text-blue-400 font-bold">{bootingSimTime}</span> detik...
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={startBootingSimulation}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Ulangi Simulasi (5 Detik)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
