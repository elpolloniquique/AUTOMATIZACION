import { PLATFORM_LABELS, type Platform } from '@/types';

interface SocialPreviewProps {
  platform: Platform;
  title: string;
  caption: string;
  imageUrl?: string;
  imageUrls?: string[];
  hashtags?: string[];
}

export function SocialPreview({ platform, title, caption, imageUrl, imageUrls, hashtags }: SocialPreviewProps) {
  const fullText = [caption, hashtags?.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')].filter(Boolean).join('\n\n');
  const carousel = imageUrls && imageUrls.length > 1 ? imageUrls : null;
  const mainImage = imageUrl || carousel?.[0];

  function renderImages(className: string) {
    if (carousel) {
      return (
        <div className="relative">
          <div className={`flex overflow-x-auto snap-x snap-mandatory ${className}`}>
            {carousel.map((url, i) => (
              <img key={i} src={url} alt="" className="w-full shrink-0 snap-center aspect-square object-cover" />
            ))}
          </div>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
            {carousel.map((_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/80" />
            ))}
          </div>
          <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
            1/{carousel.length}
          </span>
        </div>
      );
    }
    if (mainImage) {
      return <img src={mainImage} alt="" className={className} />;
    }
    return <div className={`bg-gray-100 flex items-center justify-center text-gray-400 ${className}`}>Sin imagen</div>;
  }

  if (platform === 'instagram') {
    return (
      <div className="bg-white border rounded-lg overflow-hidden max-w-sm mx-auto shadow">
        <div className="flex items-center gap-2 p-3 border-b">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
          <span className="text-sm font-semibold">elpollon_{platform}</span>
        </div>
        {renderImages('w-full aspect-square object-cover')}
        <div className="p-3 text-sm whitespace-pre-wrap">{fullText || title}</div>
      </div>
    );
  }

  if (platform === 'tiktok') {
    return (
      <div className="bg-black text-white rounded-lg overflow-hidden max-w-xs mx-auto aspect-[9/16] relative">
        {mainImage && <img src={mainImage} alt="" className="w-full h-full object-cover opacity-60" />}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black">
          <p className="font-bold text-sm">@elpollon</p>
          <p className="text-xs mt-1 whitespace-pre-wrap">{fullText || title}</p>
        </div>
      </div>
    );
  }

  // Facebook / Google default
  return (
    <div className="bg-white border rounded-lg overflow-hidden max-w-md mx-auto shadow">
      <div className="p-3 flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-pollon-red text-white flex items-center justify-center font-bold text-sm">EP</div>
        <div>
          <p className="text-sm font-semibold">El Pollón</p>
          <p className="text-xs text-gray-500">{PLATFORM_LABELS[platform]}</p>
        </div>
      </div>
      <p className="px-3 pb-2 text-sm whitespace-pre-wrap">{fullText || title}</p>
      {renderImages('w-full object-cover max-h-96')}
    </div>
  );
}
