import { useNavigate } from 'react-router-dom';
import { Images, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MediaGalleryItem } from '@/types';

interface GallerySelectionBarProps {
  selected: MediaGalleryItem[];
  maxPhotos?: number;
  onRemove: (id: string) => void;
  returnPath?: string;
}

export function GallerySelectionBar({
  selected,
  maxPhotos = 4,
  onRemove,
  returnPath = '/posts/new',
}: GallerySelectionBarProps) {
  const navigate = useNavigate();

  return (
    <div className="border rounded-lg p-4 bg-white space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Fotos seleccionadas ({selected.length}/{maxPhotos})</p>
          <p className="text-xs text-gray-500">
            {selected.length === 0
              ? 'Ve a la galería y elige hasta 4 fotos para tu publicación'
              : selected.length > 1
                ? 'Se publicarán juntas en un collage profesional'
                : 'Una foto con plantilla de marca'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(`/gallery?select=1&max=${maxPhotos}&return=${encodeURIComponent(returnPath)}`)}
        >
          <Images className="w-4 h-4 mr-1" />
          {selected.length === 0 ? 'Ir a galería' : 'Cambiar fotos'}
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((item, idx) => (
            <div key={item.id} className="relative group">
              <img
                src={item.public_url}
                alt={item.title}
                className="w-20 h-20 object-cover rounded-lg border-2 border-pollon-red/30"
              />
              <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-pollon-red text-white text-xs flex items-center justify-center font-bold">
                {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-800 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
              <p className="text-[10px] text-center mt-1 max-w-[80px] truncate">{item.title}</p>
            </div>
          ))}
          {selected.length >= 2 && (
            <div className="flex items-center text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
              <Check className="w-4 h-4 mr-1 shrink-0" />
              Collage {selected.length} fotos listo para generar
            </div>
          )}
        </div>
      )}
    </div>
  );
}
