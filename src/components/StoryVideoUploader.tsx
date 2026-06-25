import { useRef, useState } from 'react';
import { Film, Music, Upload, Volume2, VolumeX, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { StoryAudioMode } from '@/types';

const GALLERY_BUCKET = 'media-gallery';
const MAX_VIDEO_MB = 80;
const MAX_MUSIC_MB = 15;
const ACCEPTED_VIDEO = 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm';
const ACCEPTED_MUSIC = 'audio/mpeg,audio/mp3,audio/wav,.mp3,.wav';

interface StoryVideoUploaderProps {
  branchId: string;
  videoUrl: string;
  audioMode: StoryAudioMode;
  musicUrl: string;
  musicFileName: string;
  onVideoChange: (url: string) => void;
  onAudioModeChange: (mode: StoryAudioMode) => void;
  onMusicChange: (url: string, fileName: string) => void;
  onClear: () => void;
}

export function StoryVideoUploader({
  branchId,
  videoUrl,
  audioMode,
  musicUrl,
  musicFileName,
  onVideoChange,
  onAudioModeChange,
  onMusicChange,
  onClear,
}: StoryVideoUploaderProps) {
  const videoRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLInputElement>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);

  async function uploadToStorage(file: File, folder: 'videos' | 'music'): Promise<string> {
    const branchPart = branchId || 'global';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `stories/${folder}/${branchPart}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from(GALLERY_BUCKET)
      .upload(filePath, file, { upsert: false, contentType: file.type || undefined });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function handleVideoFile(file: File) {
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm)$/i.test(file.name)) {
      alert('Formato no válido. Usa MP4, MOV o WebM.');
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      alert(`El video no puede superar ${MAX_VIDEO_MB} MB`);
      return;
    }

    setUploadingVideo(true);
    try {
      const url = await uploadToStorage(file, 'videos');
      onVideoChange(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al subir video');
    } finally {
      setUploadingVideo(false);
      if (videoRef.current) videoRef.current.value = '';
    }
  }

  async function handleMusicFile(file: File) {
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav)$/i.test(file.name)) {
      alert('Formato no válido. Usa MP3 o WAV.');
      return;
    }
    if (file.size > MAX_MUSIC_MB * 1024 * 1024) {
      alert(`La música no puede superar ${MAX_MUSIC_MB} MB`);
      return;
    }

    setUploadingMusic(true);
    try {
      const url = await uploadToStorage(file, 'music');
      onMusicChange(url, file.name);
      onAudioModeChange('music');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al subir música');
    } finally {
      setUploadingMusic(false);
      if (musicRef.current) musicRef.current.value = '';
    }
  }

  const audioOptions: Array<{ value: StoryAudioMode; label: string; desc: string; icon: typeof Volume2 }> = [
    { value: 'original', label: 'Audio original', desc: 'Mantiene el sonido del video', icon: Volume2 },
    { value: 'muted', label: 'Sin música', desc: 'Video silenciado', icon: VolumeX },
    { value: 'music', label: 'Con música', desc: 'Reemplaza el audio con tu pista', icon: Music },
  ];

  return (
    <div className="space-y-4">
      <input
        ref={videoRef}
        type="file"
        accept={ACCEPTED_VIDEO}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleVideoFile(file);
        }}
      />
      <input
        ref={musicRef}
        type="file"
        accept={ACCEPTED_MUSIC}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleMusicFile(file);
        }}
      />

      {!videoUrl ? (
        <button
          type="button"
          onClick={() => videoRef.current?.click()}
          disabled={uploadingVideo}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-pollon-red hover:bg-red-50/50 transition-colors"
        >
          <Film className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <p className="font-medium text-sm">
            {uploadingVideo ? 'Subiendo video...' : 'Subir video para historia'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            MP4, MOV o WebM · Vertical recomendado · Máx. {MAX_VIDEO_MB} MB · 60 s
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" disabled={uploadingVideo}>
            <Upload className="w-4 h-4 mr-1" />
            Seleccionar archivo
          </Button>
        </button>
      ) : (
        <div className="relative rounded-xl overflow-hidden border bg-black">
          <video
            src={videoUrl}
            className="w-full max-h-64 object-contain mx-auto"
            controls
            muted={audioMode === 'muted'}
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => videoRef.current?.click()}>
              Cambiar video
            </Button>
          </div>
        </div>
      )}

      {videoUrl && (
        <div className="rounded-xl border bg-gray-50/80 p-4 space-y-3">
          <Label className="text-sm font-medium">Audio del video</Label>
          <div className="grid gap-2">
            {audioOptions.map((opt) => {
              const Icon = opt.icon;
              const selected = audioMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onAudioModeChange(opt.value)}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                    selected
                      ? 'border-pollon-red bg-red-50 ring-1 ring-pollon-red/30'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${selected ? 'text-pollon-red' : 'text-gray-400'}`} />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {audioMode === 'music' && (
            <div className="pt-2 border-t space-y-2">
              {!musicUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingMusic}
                  onClick={() => musicRef.current?.click()}
                >
                  <Music className="w-4 h-4 mr-1" />
                  {uploadingMusic ? 'Subiendo...' : 'Subir pista de música (MP3/WAV)'}
                </Button>
              ) : (
                <div className="flex items-center justify-between gap-2 bg-white border rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Music className="w-4 h-4 text-pollon-red shrink-0" />
                    <span className="text-sm truncate">{musicFileName || 'Pista seleccionada'}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button type="button" size="sm" variant="ghost" onClick={() => musicRef.current?.click()}>
                      Cambiar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => onMusicChange('', '')}
                    >
                      Quitar
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500">
                La música se mezcla al publicar. Usa pistas con licencia para uso comercial.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
