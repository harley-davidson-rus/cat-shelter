import React, { useState, useEffect } from 'react';
import { Heart, Search, ShieldCheck, Sparkles, Home, ArrowDown, Cat as CatIcon } from 'lucide-react';
import { Cat, ShelterStats } from '../types';

interface HeroSectionProps {
  onExploreClick: () => void;
  onHowToAdoptClick: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  heroCat?: Cat;
  onHeroCatClick?: (cat: Cat) => void;
  isLoading?: boolean;
  shelterStats: ShelterStats;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreClick,
  onHowToAdoptClick,
  searchQuery,
  onSearchChange,
  heroCat,
  onHeroCatClick,
  isLoading = false,
  shelterStats,
}) => {
  // Safe validator for photo string (rejects broken dev paths)
  const isValidPhoto = (src?: string | null): boolean => {
    if (!src || typeof src !== 'string') return false;
    const trimmed = src.trim();
    if (!trimmed) return false;
    if (
      trimmed.includes('regenerated_image_') ||
      trimmed.startsWith('./') ||
      trimmed.startsWith('/src/') ||
      trimmed.startsWith('src/')
    ) {
      return false;
    }
    return true;
  };

  // Determine current active photo with fallback
  const getResolvedPhoto = (): string => {
    const heroPhoto = heroCat?.photos?.[0];
    if (isValidPhoto(heroPhoto) && heroPhoto) return heroPhoto;
    return '';
  };

  const [displayPhoto, setDisplayPhoto] = useState<string>(getResolvedPhoto);

  useEffect(() => {
    setDisplayPhoto(getResolvedPhoto());
  }, [heroCat?.photos?.[0]]);

  const handleImageError = () => {
    setDisplayPhoto('');
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24">
      {/* Background soft ambient accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute top-20 left-10 w-80 h-80 bg-orange-100/50 rounded-full blur-2xl -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Text & Search Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100/80 text-amber-900 border border-amber-200/80 text-xs sm:text-sm font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>АНО&nbsp;«Фонд помощи животным <span className="whitespace-nowrap">«Доброта&nbsp;для&nbsp;кота»</span>»</span>
            </div>

            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold text-stone-900 tracking-tight leading-[1.15]">
              Каждый котик заслуживает{' '}
              <span className="text-amber-600 underline decoration-amber-300 decoration-wavy decoration-2">
                любящую семью
              </span>{' '}
              и&nbsp;тёплый дом
            </h1>

            <p className="text-base sm:text-lg text-stone-600 max-w-2xl leading-relaxed">
              Фонд помощи животным <span className="whitespace-nowrap">«Доброта&nbsp;для&nbsp;кота»</span> лечит, социализирует и&nbsp;бережно передаёт котиков в&nbsp;заботливые руки после подписания согласия на ответственное содержание. Познакомьтесь с&nbsp;нашими подопечными онлайн и&nbsp;подайте заявку на&nbsp;усыновление прямо сейчас!
            </p>

            {/* Fast Interactive Search Bar */}
            <div className="pt-2 max-w-xl mx-auto lg:mx-0">
              <div className="relative flex items-center shadow-md shadow-stone-200/60 rounded-2xl bg-white border border-stone-200 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200 transition-all p-1.5">
                <Search className="w-5 h-5 text-stone-400 ml-3 shrink-0" />
                <input
                  id="hero-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Поиск по имени, породе или окрасу (например: Барсик, рыжий)..."
                  className="w-full px-3 py-2.5 text-stone-800 placeholder-stone-400 bg-transparent text-sm focus:outline-none"
                />
                <button
                  onClick={onExploreClick}
                  className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-medium transition-colors shrink-0"
                >
                  Найти
                </button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
              <button
                id="hero-explore-cats-btn"
                onClick={onExploreClick}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm sm:text-base shadow-md shadow-amber-500/25 hover:shadow-lg transition-all cursor-pointer"
              >
                <span>Выбрать котика в каталоге</span>
                <ArrowDown className="w-4 h-4" />
              </button>

              <button
                id="hero-how-to-adopt-btn"
                onClick={onHowToAdoptClick}
                className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-semibold text-sm sm:text-base shadow-xs transition-colors cursor-pointer"
              >
                <span>Правила усыновления</span>
              </button>
            </div>

            {/* Key Shelter Pillars */}
            <div className="pt-4 grid grid-cols-3 gap-3 border-t border-amber-100 max-w-xl mx-auto lg:mx-0">
              <div className="text-center lg:text-left">
                <div className="font-heading font-black text-2xl sm:text-3xl text-stone-900">
                  {shelterStats.adoptedCount}+
                </div>
                <div className="text-xs text-stone-500 font-medium">Котиков нашли дом</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="font-heading font-black text-2xl sm:text-3xl text-amber-600">
                  {shelterStats.currentCount}
                </div>
                <div className="text-xs text-stone-500 font-medium">Ждут свою семью</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="font-heading font-black text-2xl sm:text-3xl text-emerald-600">
                  100%
                </div>
                <div className="text-xs text-stone-500 font-medium">Привиты</div>
              </div>
            </div>
          </div>

          {/* Featured Visual Image Collage */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-amber-900 shadow-sm">
                <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
                <h2 className="font-heading text-sm font-extrabold uppercase tracking-wide">Герой дня</h2>
              </div>
              <div
                className={`group relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-4/3 sm:aspect-5/4 bg-stone-100 ${heroCat ? 'cursor-pointer' : ''}`}
                onClick={() => heroCat && onHeroCatClick?.(heroCat)}
                onKeyDown={(event) => {
                  if (heroCat && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onHeroCatClick?.(heroCat);
                  }
                }}
                role={heroCat ? 'button' : undefined}
                tabIndex={heroCat ? 0 : undefined}
                aria-label={heroCat ? `Открыть анкету котика ${heroCat.name}` : undefined}
              >
                {displayPhoto ? (
                  <img
                    src={displayPhoto}
                    alt={heroCat?.name ? `${heroCat.name} — подопечный фонда` : 'Подопечный фонда'}
                    onError={handleImageError}
                    fetchPriority="high"
                    decoding="async"
                    style={{
                      objectPosition: (heroCat?.primaryPhotoPosition?.x ?? 50) + '% ' + (heroCat?.primaryPhotoPosition?.y ?? 30) + '%',
                    }}
                    className="w-full h-full object-cover transition-all duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-amber-50 to-stone-100 text-stone-400">
                    <CatIcon className="w-14 h-14 text-amber-300" aria-hidden="true" />
                    <span className="text-sm font-semibold">
                      {isLoading ? 'Загружаем фотографию…' : 'Фотография скоро появится'}
                    </span>
                  </div>
                )}

                {/* Gradient and Cat Info Banner */}
                <div className={`${heroCat && displayPhoto ? '' : 'hidden'} absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none`} />
                <div className={`${heroCat && displayPhoto ? '' : 'hidden'} absolute bottom-4 left-4 right-4 text-white pointer-events-none`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold shadow-xs">
                      Подопечный
                    </span>
                    <span className="text-xs font-bold text-stone-100 drop-shadow-xs">
                      {heroCat?.name || 'Подопечный передержки'}{heroCat?.age ? `, ${heroCat.age}` : ''}
                    </span>
                  </div>
                  {heroCat?.story ? (
                    <p className="text-xs sm:text-sm font-medium text-white/95 drop-shadow-xs leading-snug line-clamp-2">
                      {heroCat.story}
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm font-medium text-white/95 drop-shadow-xs leading-snug">
                      Реальный подопечный нашей временной передержки
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};







