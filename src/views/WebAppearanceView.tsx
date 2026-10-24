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
  Maximize2,
  HardDrive,
  Layout
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { compressImage, compressPngLogo } from '../lib/imageCompressor';
import { CompanySettings } from '../types/accounting';
import { uploadHeavyFileToDrive, SPECTRA_DRIVE_FOLDER_URL } from '../services/googleDriveBot';

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

  // 2B. Background Dashboard Header states (Configurable Executive Banner)
  const [headerBgUrl, setHeaderBgUrl] = useState<string>(
    settings.dashboardHeaderBgImage || PRESET_BACKGROUNDS[1].url
  );
  const [headerDarkness, setHeaderDarkness] = useState<'dark' | 'medium' | 'light'>(
    settings.dashboardHeaderOverlayDarkness || 'dark'
  );
  const [headerBgPosX, setHeaderBgPosX] = useState<number>(settings.dashboardHeaderBgPosX ?? 50);
  const [headerBgPosY, setHeaderBgPosY] = useState<number>(settings.dashboardHeaderBgPosY ?? 50);
  const [headerBgZoom, setHeaderBgZoom] = useState<number>(settings.dashboardHeaderBgZoom ?? 100);

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
    if (settings.dashboardHeaderBgImage) setHeaderBgUrl(settings.dashboardHeaderBgImage);
    if (settings.dashboardHeaderOverlayDarkness) setHeaderDarkness(settings.dashboardHeaderOverlayDarkness);
    if (settings.dashboardHeaderBgPosX !== undefined) setHeaderBgPosX(settings.dashboardHeaderBgPosX);
    if (settings.dashboardHeaderBgPosY !== undefined) setHeaderBgPosY(settings.dashboardHeaderBgPosY);
    if (settings.dashboardHeaderBgZoom !== undefined) setHeaderBgZoom(settings.dashboardHeaderBgZoom);
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
      setSaveMessage('Mengompres dan mengunggah ke Google Drive...');
      // 1. Compress image to clean HD
      const compressed = await compressImage(file, 1920, 1080, 0.85);
      
      // 2. Offload heavy binary to Google Drive Bot (Folder: 1W0rIE3dXHVm6JwB9glV0yWB80QcEUywn)
      const offloadRes = await uploadHeavyFileToDrive(
        compressed,
        `login_bg_${Date.now()}.jpg`,
        'image/jpeg',
        { title: 'Background Login SPECTRA', uploadedBy: 'Administrator' }
      );

      const targetUrl = (offloadRes.success && offloadRes.directUrl) ? offloadRes.directUrl : compressed;
      setBgImageUrl(targetUrl);
      autoSaveSettings({
        loginBgImage: targetUrl,
        loginBgPosX: bgPosX,
        loginBgPosY: bgPosY,
        loginBgZoom: bgZoom
      }, offloadRes.success 
        ? 'Foto background berhasil disimpan ke Google Drive Anda & disinkronkan ke Cloud!' 
        : 'Foto background tersimpan secara lokal.');
      logActivity('Tampilan Web', 'Mengunggah foto background login ke Google Drive (Supabase hemat)');
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
      setSaveMessage('Mengompres dan mengunggah background booting ke Google Drive...');
      const compressed = await compressImage(file, 1920, 1080, 0.85);
      
      // Offload to Google Drive Bot
      const offloadRes = await uploadHeavyFileToDrive(
        compressed,
        `booting_bg_${Date.now()}.jpg`,
        'image/jpeg',
        { title: 'Background Booting 5 Detik', uploadedBy: 'Administrator' }
      );

      const targetUrl = (offloadRes.success && offloadRes.directUrl) ? offloadRes.directUrl : compressed;
      setBootingBgUrl(targetUrl);
      autoSaveSettings({ 
        bootingBgImage: targetUrl,
        bootingOverlayDarkness: bootingDarkness,
        bootingBgPosX,
        bootingBgPosY,
        bootingBgZoom
      }, offloadRes.success 
        ? 'Background booting berhasil disimpan ke Google Drive & disinkronkan!' 
        : 'Background booting berhasil tersimpan!');
      logActivity('Tampilan Web', 'Memperbarui background booting ke Google Drive (Supabase hemat)');
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
      setSaveMessage('Mengunggah logo resmi ke Google Drive...');
      const compressed = await compressPngLogo(file, 512, 256);
      
      // Offload to Google Drive Bot
      const offloadRes = await uploadHeavyFileToDrive(
        compressed,
        `logo_spectra_${Date.now()}.png`,
        'image/png',
        { title: 'Logo Perusahaan SPECTRA', uploadedBy: 'Administrator' }
      );

      const targetUrl = (offloadRes.success && offloadRes.directUrl) ? offloadRes.directUrl : compressed;
      setLogoUrl(targetUrl);
      autoSaveSettings({ 
        loginLogoUrl: targetUrl, 
        loginLogoHeight: logoHeight 
      }, offloadRes.success 
        ? 'Logo resmi berhasil disimpan ke Google Drive & disinkronkan!' 
        : 'Logo transparan baru berhasil diunggah & tersimpan!');
      logActivity('Tampilan Web', 'Memperbarui logo perusahaan ke Google Drive (Supabase hemat)');
    } catch (err: any) {
      alert('Gagal memproses logo: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Upload handler for Dashboard Header background
  const handleHeaderFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Ukuran file maksimal 15MB. Silakan pilih gambar lain.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage('Mengompres dan mengunggah background header dashboard ke Google Drive...');
      const compressed = await compressImage(file, 1920, 1080, 0.85);
      
      const offloadRes = await uploadHeavyFileToDrive(
        compressed,
        `header_bg_${Date.now()}.jpg`,
        'image/jpeg',
        { title: 'Background Header Dashboard', uploadedBy: 'Administrator' }
      );

      const targetUrl = (offloadRes.success && offloadRes.directUrl) ? offloadRes.directUrl : compressed;
      setHeaderBgUrl(targetUrl);
      autoSaveSettings({ 
        dashboardHeaderBgImage: targetUrl,
        dashboardHeaderOverlayDarkness: headerDarkness,
        dashboardHeaderBgPosX: headerBgPosX,
        dashboardHeaderBgPosY: headerBgPosY,
        dashboardHeaderBgZoom: headerBgZoom
      }, offloadRes.success 
        ? 'Background header dashboard berhasil disimpan ke Google Drive & disinkronkan!' 
        : 'Background header dashboard berhasil tersimpan!');
      logActivity('Tampilan Web', 'Memperbarui background header dashboard ke Google Drive (Supabase hemat)');
    } catch (err: any) {
      alert('Gagal memproses gambar header: ' + (err.message || err));
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

  const handleSelectHeaderPreset = (url: string) => {
    setHeaderBgUrl(url);
    autoSaveSettings({ 
      dashboardHeaderBgImage: url,
      dashboardHeaderOverlayDarkness: headerDarkness,
      dashboardHeaderBgPosX: headerBgPosX,
      dashboardHeaderBgPosY: headerBgPosY,
      dashboardHeaderBgZoom: headerBgZoom
    }, 'Preset header dashboard aktif dan otomatis tersimpan!');
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
      dashboardHeaderBgImage: headerBgUrl,
      dashboardHeaderOverlayDarkness: headerDarkness,
      dashboardHeaderBgPosX: headerBgPosX,
      dashboardHeaderBgPosY: headerBgPosY,
      dashboardHeaderBgZoom: headerBgZoom,
      loginLogoUrl: logoUrl,
      loginLogoHeight: logoHeight,
      loginQuote: quote,
      loginSubtitle: subtitle,
      loginOverlayDarkness: darkness
    });

    logActivity(
      'Pengaturan Tampilan',
      'Administrator memperbarui konfigurasi background login, background booting, background header dashboard, logo, serta posisi crop gambar.'
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
      const defaultHeaderBg = PRESET_BACKGROUNDS[1].url;
      const defaultLogo = './assets/NBE_white.png';
      const defaultQuote = 'Driving sustainable energy excellence through decisive leadership, asset intelligence, and synchronized executive oversight.';
      const defaultSubtitle = 'Please enter your corporate credentials to access the executive portal.';
      
      setBgImageUrl(defaultBg);
      setBgPosX(50);
      setBgPosY(50);
      setBgZoom(100);
      setBootingBgUrl(defaultBootingBg);
      setHeaderBgUrl(defaultHeaderBg);
      setHeaderDarkness('dark');
      setHeaderBgPosX(50);
      setHeaderBgPosY(50);
      setHeaderBgZoom(100);
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
        dashboardHeaderBgImage: defaultHeaderBg,
        dashboardHeaderOverlayDarkness: 'dark',
        dashboardHeaderBgPosX: 50,
        dashboardHeaderBgPosY: 50,
        dashboardHeaderBgZoom: 100,
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

      {/* 1.1 Google Drive Storage Offloader & Supabase Size Guard Banner */}
      <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 rounded-2xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-700 rounded-xl border border-emerald-300 shrink-0 mt-0.5">
            <HardDrive className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-800">
                Penyimpanan Otomatis Google Drive Aktif
              </h3>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              Semua foto dan berkas berat otomatis dialihkan dan disimpan ke folder Google Drive Anda. Supabase hanya merekam link URL dan riwayat aktivitas sehingga ukuran database tetap sangat kecil (~32 kB) dan selalu aman jauh di bawah limit gratis Supabase (500 MB).
            </p>
          </div>
        </div>

        <a
          href={SPECTRA_DRIVE_FOLDER_URL}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
        >
          <span>Buka Folder Drive</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* 2. Action Feedback Indicator */}
      {(isSaved || isSaving) && (
        <div className="flex items-center justify-end gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
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
      )}

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
          {/* CARD 3: FOTO BACKGROUND HEADER DASHBOARD (BANNER EKSEKUTIF) */}
          {/* ======================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layout className="w-4 h-4 text-indigo-600" />
                <span>3. Foto Background Header Dashboard (Banner Eksekutif)</span>
              </h2>
              <span className="text-[10px] font-semibold text-slate-400">Tampilan Utama Dashboard</span>
            </div>

            {/* Info Google Drive Sync */}
            <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-2.5 text-xs text-indigo-900">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold">Google Drive Storage Bot Aktif:</span>
                  <span className="text-[11px] text-indigo-700 ml-1">Foto otomatis dikompres &amp; diarsipkan ke Drive agar database Supabase tetap ringan.</span>
                </div>
              </div>
              <a 
                href={SPECTRA_DRIVE_FOLDER_URL} 
                target="_blank" 
                rel="noreferrer"
                className="shrink-0 ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 transition"
              >
                <span>Buka Drive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Upload File */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Unggah Foto Background Header Dashboard
              </label>
              <label className="flex border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-xl p-3 text-center cursor-pointer transition items-center justify-center gap-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-semibold text-slate-700">Pilih Berkas Foto Baru</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleHeaderFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* URL Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Atau Masukkan Tautan (URL) Foto Header
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="url"
                    value={headerBgUrl}
                    onChange={(e) => {
                      setHeaderBgUrl(e.target.value);
                      autoSaveSettings({ 
                        dashboardHeaderBgImage: e.target.value,
                        dashboardHeaderOverlayDarkness: headerDarkness,
                        dashboardHeaderBgPosX: headerBgPosX,
                        dashboardHeaderBgPosY: headerBgPosY,
                        dashboardHeaderBgZoom: headerBgZoom
                      }, 'Tautan foto header dashboard diperbarui!');
                    }}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Preset Options for Header */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pilih Preset Industri Energi &amp; Migas (Cepat)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_BACKGROUNDS.map((preset) => (
                  <button
                    key={`header-${preset.id}`}
                    type="button"
                    onClick={() => handleSelectHeaderPreset(preset.url)}
                    className={`relative rounded-xl overflow-hidden border text-left p-1.5 transition cursor-pointer ${
                      headerBgUrl === preset.url 
                        ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/40' 
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="h-16 w-full rounded-lg overflow-hidden bg-slate-100 mb-1.5 relative">
                      <img 
                        src={preset.thumb} 
                        alt={preset.title} 
                        className="w-full h-full object-cover" 
                      />
                      {headerBgUrl === preset.url && (
                        <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-xs">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-slate-800 line-clamp-1">{preset.title}</div>
                    <div className="text-[9px] text-slate-400">{preset.category}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Position and Zoom Adjustment */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-indigo-600" />
                  Atur Fokus &amp; Zoom Banner Header
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  X: {headerBgPosX}% | Y: {headerBgPosY}% | Zoom: {headerBgZoom}%
                </span>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                    <span>Posisi Horizontal (X)</span>
                    <span className="font-mono text-indigo-700">{headerBgPosX}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={headerBgPosX}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setHeaderBgPosX(val);
                      autoSaveSettings({ 
                        dashboardHeaderBgImage: headerBgUrl,
                        dashboardHeaderOverlayDarkness: headerDarkness,
                        dashboardHeaderBgPosX: val,
                        dashboardHeaderBgPosY: headerBgPosY,
                        dashboardHeaderBgZoom: headerBgZoom
                      });
                    }}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                    <span>Kiri</span>
                    <span>Tengah</span>
                    <span>Kanan</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                    <span>Posisi Vertikal (Y)</span>
                    <span className="font-mono text-indigo-700">{headerBgPosY}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={headerBgPosY}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setHeaderBgPosY(val);
                      autoSaveSettings({ 
                        dashboardHeaderBgImage: headerBgUrl,
                        dashboardHeaderOverlayDarkness: headerDarkness,
                        dashboardHeaderBgPosX: headerBgPosX,
                        dashboardHeaderBgPosY: val,
                        dashboardHeaderBgZoom: headerBgZoom
                      });
                    }}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                    <span>Atas</span>
                    <span>Tengah</span>
                    <span>Bawah</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                    <span className="flex items-center gap-1">
                      <ZoomIn className="w-3 h-3 text-indigo-600" />
                      Perbesaran (Zoom)
                    </span>
                    <span className="font-mono text-indigo-700">{headerBgZoom}%</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="200"
                    step="5"
                    value={headerBgZoom}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setHeaderBgZoom(val);
                      autoSaveSettings({ 
                        dashboardHeaderBgImage: headerBgUrl,
                        dashboardHeaderOverlayDarkness: headerDarkness,
                        dashboardHeaderBgPosX: headerBgPosX,
                        dashboardHeaderBgPosY: headerBgPosY,
                        dashboardHeaderBgZoom: val
                      });
                    }}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                    <span>100%</span>
                    <span>150%</span>
                    <span>200%</span>
                  </div>
                </div>
              </div>

              {/* 9-Point Alignment Preset Grid for Header */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                  Titik Fokus Cepat (9-Point Focus)
                </label>
                <div className="grid grid-cols-3 gap-1.5 max-w-xs">
                  {[
                    { label: 'Kiri Atas', x: 0, y: 0 },
                    { label: 'Tengah Atas', x: 50, y: 0 },
                    { label: 'Kanan Atas', x: 100, y: 0 },
                    { label: 'Kiri Tengah', x: 0, y: 50 },
                    { label: 'Pusat (Center)', x: 50, y: 50 },
                    { label: 'Kanan Tengah', x: 100, y: 50 },
                    { label: 'Kiri Bawah', x: 0, y: 100 },
                    { label: 'Tengah Bawah', x: 50, y: 100 },
                    { label: 'Kanan Bawah', x: 100, y: 100 }
                  ].map((pos, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setHeaderBgPosX(pos.x);
                        setHeaderBgPosY(pos.y);
                        autoSaveSettings({ 
                          dashboardHeaderBgImage: headerBgUrl,
                          dashboardHeaderOverlayDarkness: headerDarkness,
                          dashboardHeaderBgPosX: pos.x,
                          dashboardHeaderBgPosY: pos.y,
                          dashboardHeaderBgZoom: headerBgZoom
                        });
                      }}
                      className={`text-[10px] py-1 px-1 rounded-lg border text-center transition cursor-pointer ${
                        headerBgPosX === pos.x && headerBgPosY === pos.y
                          ? 'bg-indigo-600 text-white font-bold border-indigo-700 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Darkness Selector for Header */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tingkat Kegelapan Filter Header (Agar Teks &amp; Tombol Terbaca Jelas)
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
                        setHeaderDarkness(item.id as any);
                        autoSaveSettings({ 
                          dashboardHeaderBgImage: headerBgUrl,
                          dashboardHeaderOverlayDarkness: item.id as any,
                          dashboardHeaderBgPosX: headerBgPosX,
                          dashboardHeaderBgPosY: headerBgPosY,
                          dashboardHeaderBgZoom: headerBgZoom
                        });
                      }}
                      className={`py-2 px-2 text-xs font-semibold rounded-xl border text-center transition cursor-pointer ${
                        headerDarkness === item.id
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* CARD 4: GANTI LOGO & SESUAIKAN UKURAN (User Request) */}
          {/* ======================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>4. Logo Perusahaan di Halaman Login &amp; Booting</span>
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
          {/* CARD 5: TEKS SLOGAN & TINGKAT KEGELAPAN OVERLAY */}
          {/* ======================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Quote className="w-4 h-4 text-purple-600" />
                <span>5. Pesan Korporat &amp; Intensitas Kegelapan Filter</span>
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
        <div className="lg:col-span-5 sticky top-20 space-y-4">
          
          {/* Live Preview 1: Header Dashboard Banner (User Request Prom UI) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layout className="w-3.5 h-3.5 text-indigo-600" />
                Live Preview: Banner Header Dashboard
              </span>
              <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                Otomatis Sinkron
              </span>
            </div>

            {/* Mockup Header Dashboard Banner matching Prom UI No 1 */}
            <div className="relative rounded-2xl overflow-hidden shadow-md border border-slate-700/60 text-white min-h-[140px] flex flex-col justify-between">
              {/* Background Photo */}
              <div className="absolute inset-0 overflow-hidden bg-slate-950">
                <img 
                  src={headerBgUrl} 
                  alt="Dashboard Header Preview" 
                  style={{
                    objectPosition: `${headerBgPosX}% ${headerBgPosY}%`,
                    transform: `scale(${headerBgZoom / 100})`,
                    transformOrigin: `${headerBgPosX}% ${headerBgPosY}%`
                  }}
                  className="w-full h-full object-cover transition-all duration-300" 
                />
              </div>

              {/* Overlay Darkness */}
              <div className={`absolute inset-0 ${getOverlayClass(headerDarkness)}`} />

              {/* Content Header Banner */}
              <div className="relative z-10 p-3.5 space-y-0.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-300 font-bold drop-shadow">
                  Financial Reporting System
                </div>
                <h3 className="text-sm font-extrabold text-white tracking-tight drop-shadow leading-tight">
                  {settings.companyName || 'PT Nirwana Bhumi Energy'}
                </h3>
              </div>

              {/* 4 Bottom Action Buttons */}
              <div className="relative z-10 p-2.5 pt-0">
                <div className="grid grid-cols-4 gap-1.5 bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
                  <div className="text-center py-1 px-1 bg-white/10 rounded-lg text-[8px] font-bold text-white truncate">
                    Laporan Sederhana
                  </div>
                  <div className="text-center py-1 px-1 bg-white/10 rounded-lg text-[8px] font-bold text-white truncate">
                    Laporan Resmi
                  </div>
                  <div className="text-center py-1 px-1 bg-white/10 rounded-lg text-[8px] font-bold text-white truncate">
                    Quick Report
                  </div>
                  <div className="text-center py-1 px-1 bg-white/10 rounded-lg text-[8px] font-bold text-white truncate">
                    Analisis Rasio
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview 2: Login Page Preview (65% : 35%) */}
          <div className="space-y-2 pt-1 border-t border-slate-200">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-purple-600" />
                Pratinjau Hasil Desain Login (Rasio 65% : 35%)
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
            Halaman login menggunakan rasio <strong>65% latar belakang</strong> dan <strong>35% panel login</strong>. Pengaturan posisi, crop, dan logo otomatis disinkronkan ke seluruh sesi pengguna dan cloud.
          </div>
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
            {/* Clean Avatar / Logo container without cheesy AI border */}
            <div className="inline-flex p-3.5 bg-white/95 backdrop-blur-xs rounded-2xl shadow-2xl">
              <img 
                src={logoUrl && !logoUrl.includes('_white') ? logoUrl : './assets/NBE.png'} 
                alt="Logo NBE" 
                style={{ height: `${Math.max(48, Math.min(84, logoHeight + 16))}px`, width: 'auto' }}
                className="max-w-[200px] object-contain" 
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-wide">
                Mazmur Gusti Agung Larosa
              </h2>
              <div className="h-1 w-16 bg-blue-500 mx-auto rounded-full"></div>
              <p className="text-base font-semibold text-sky-300">
                Selamat Datang Kembali Direktur Keuangan
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
