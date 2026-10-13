import React from 'react';
import { Heart, ShieldCheck, Check, Sparkles, ArrowRight, Baby, Cat as CatIcon, Dog, Video, Edit3 } from 'lucide-react';
import { Cat, CatSize, CatTemperament } from '../types';
import realCatPhoto from '../assets/defaultCat';

interface CatCardProps {
  cat: Cat;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onViewDetails: (cat: Cat) => void;
  onApplyForAdoption: (cat: Cat) => void;
  onEditCat?: (cat: Cat) => void;
  detailHref?: string;
  searchQuery?: string;
}

const SIZE_SHORT: Record<CatSize, string> = {
  small: 'Мини',
  medium: 'Средний',
  large: 'Крупный',
};

const TEMPERAMENT_SHORT: Record<CatTemperament, string> = {
  cuddly: 'Ласковый',
  playful: 'Игривый',
  calm: 'Спокойный',
  independent: 'Независимый',
  curious: 'Любопытный',
};

const normalizeSearch = (value: string): string => value.trim().toLocaleLowerCase('ru');

const highlightMatches = (text: string, query: string): React.ReactNode => {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return text;

  const normalizedText = text.toLocaleLowerCase('ru');
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let matchIndex = normalizedText.indexOf(normalizedQuery);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex));
    parts.push(
      <mark
        key={matchIndex}
        className="rounded-sm bg-amber-300 px-0.5 text-inherit"
      >
        {text.slice(matchIndex, matchIndex + normalizedQuery.length)}
      </mark>,
    );
    cursor = matchIndex + normalizedQuery.length;
    matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length > 0 ? parts : text;
};

const matchingSnippet = (text: string, query: string): string => {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return text;

  const matchIndex = text.toLocaleLowerCase('ru').indexOf(normalizedQuery);
  if (matchIndex < 0) return text;

  const rawStart = Math.max(0, matchIndex - 55);
  const rawEnd = Math.min(text.length, matchIndex + normalizedQuery.length + 90);
  const wordStart = rawStart > 0 ? text.indexOf(' ', rawStart) : 0;
  const wordEnd = rawEnd < text.length ? text.lastIndexOf(' ', rawEnd) : text.length;
  const start = wordStart >= 0 && wordStart < matchIndex ? wordStart + 1 : rawStart;
  const end = wordEnd > matchIndex ? wordEnd : rawEnd;
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
};

export const CatCard: React.FC<CatCardProps> = ({
  cat,
  isFavorite,
  onToggleFavorite,
  onViewDetails,
  onApplyForAdoption,
  onEditCat,
  detailHref,
  searchQuery = '',
}) => {
  const isAvailable = cat.status === 'available';
  const statusLabel = cat.status === 'available'
    ? 'Ищет дом'
    : cat.status === 'reserved'
      ? 'На бронировании'
      : cat.status === 'trial'
        ? 'На испытательном сроке'
        : 'Уже дома';
  const hasVideos = cat.videos && cat.videos.length > 0;
  const normalizedSearch = normalizeSearch(searchQuery);
  const storyMatches = Boolean(normalizedSearch && cat.story.toLocaleLowerCase('ru').includes(normalizedSearch));
  const storyText = storyMatches ? matchingSnippet(cat.story, searchQuery) : cat.story;
  const visibleTraits = normalizedSearch
    ? [
        ...cat.character.filter((trait) => trait.toLocaleLowerCase('ru').includes(normalizedSearch)),
        ...cat.character.filter((trait) => !trait.toLocaleLowerCase('ru').includes(normalizedSearch)),
      ].slice(0, 3)
    : cat.character.slice(0, 3);

  return (
    <article
      id={`cat-card-${cat.id}`}
      onClick={() => onViewDetails(cat)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onViewDetails(cat);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Открыть анкету котика ${cat.name}`}
      className="group cursor-pointer bg-white rounded-3xl overflow-hidden border border-stone-200/80 shadow-xs hover:shadow-xl hover:border-amber-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 transition-all duration-300 flex flex-col justify-between"
    >
      <div>
        {/* Cat Photo Box with Head-first Framing & Badges */}
        <div className="relative aspect-4/3 overflow-hidden bg-stone-950 flex items-center justify-center">

          <img
            src={cat.photos[0] || realCatPhoto}
            alt={`Котик ${cat.name}`}
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              if (target.src !== realCatPhoto) {
                target.src = realCatPhoto;
              }
            }}
            className="relative z-5 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            style={{ objectPosition: (cat.primaryPhotoPosition?.x ?? 50) + '% ' + (cat.primaryPhotoPosition?.y ?? 30) + '%' }}
            loading="lazy"
            decoding="async"
          />

          {/* Gentle gradient overlay only at the bottom for legibility, keeping head completely clear */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none z-10" />

          {/* Top Badges & Actions (streamlined so cat's head & ears are fully visible) */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-auto">
            <div className="flex items-center gap-1 flex-wrap">
              {/* Status Badge */}
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm backdrop-blur-md ${
                  isAvailable
                    ? 'bg-emerald-500/90 text-white'
                    : cat.status === 'reserved'
                      ? 'bg-amber-500/90 text-white'
                      : cat.status === 'trial'
                        ? 'bg-sky-600/90 text-white'
                        : 'bg-stone-600/90 text-white'
                }`}
              >
                {statusLabel}
              </span>
              {/* Gender Badge */}
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold backdrop-blur-md shadow-sm ${
                  cat.gender === 'male'
                    ? 'bg-sky-500/90 text-white'
                    : 'bg-rose-500/90 text-white'
                }`}
              >
                {cat.gender === 'male' ? 'Мальчик' : 'Девочка'}
              </span>
              {/* Video Badge */}
              {hasVideos && (
                <span
                  title="Есть видеоролик с котиком"
                  className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/90 text-white flex items-center gap-1 shadow-sm backdrop-blur-md"
                >
                  <Video className="w-3 h-3" />
                  <span>{cat.videos.length}</span>
                </span>
              )}
            </div>

            {/* Favorite & Edit Buttons */}
            <div className="flex items-center gap-1.5">
              {onEditCat && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCat(cat);
                  }}
                  title="Редактировать анкету котика"
                  aria-label="Редактировать анкету котика"
                  className="p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white hover:text-amber-300 hover:scale-110 active:scale-95 transition-all shadow-md backdrop-blur-md cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                id={`fav-btn-${cat.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(cat.id);
                }}
                aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
                className="p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white hover:scale-110 active:scale-95 transition-all shadow-md backdrop-blur-md cursor-pointer"
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    isFavorite ? 'fill-rose-500 text-rose-500' : 'text-white'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Bottom Overlay on Image: Age, Size, Photos Count */}
          <div className="absolute bottom-3 left-3 right-3 text-white flex items-end justify-between pointer-events-none z-20">
            <div className="flex items-center gap-1.5 flex-wrap">
              {cat.age && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-sm">
                  {cat.age}
                </span>
              )}
              {cat.size && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-sm">
                  {SIZE_SHORT[cat.size]}
                </span>
              )}
            </div>

            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
              {cat.photos.length} фото
            </span>
          </div>
        </div>

        {/* Content Box */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-heading text-2xl font-extrabold text-stone-900 group-hover:text-amber-600 transition-colors">
              {highlightMatches(cat.name, searchQuery)}
            </h3>
            {cat.temperament && (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold shrink-0">
                {TEMPERAMENT_SHORT[cat.temperament]}
              </span>
            )}
          </div>

          {(cat.breed || cat.color) && (
            <p className="text-xs text-stone-500 font-medium mb-3 line-clamp-1">
              {highlightMatches([cat.breed, cat.color].filter(Boolean).join(' • '), searchQuery)}
            </p>
          )}

          {/* Short Story Snippet or note */}
          {cat.story ? (
            <p className={`text-xs text-stone-600 line-clamp-2 mb-4 leading-relaxed ${storyMatches ? 'rounded-lg bg-amber-50 px-1.5 py-1' : ''}`}>
              {highlightMatches(storyText, searchQuery)}
            </p>
          ) : (
            <p className="text-xs text-stone-400 italic mb-4">
              Реальный подопечный временной передержки
            </p>
          )}

          {/* Character traits badges if present */}
          {cat.character && cat.character.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {visibleTraits.map((trait, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700 text-[11px] font-semibold"
                >
                  {highlightMatches(trait, searchQuery)}
                </span>
              ))}
            </div>
          )}

          {/* Health & Compatibility Badges */}
          <div className="py-2.5 px-3 bg-stone-50 rounded-2xl border border-stone-100 mb-4 flex items-center justify-between text-xs text-stone-600">
            <div
              className="flex items-center gap-1"
              title={cat.gender === 'female' ? 'Привита и обработана' : 'Привит и обработан'}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-medium text-[11px]">
                {cat.gender === 'female' ? 'Привита' : 'Привит'}
              </span>
            </div>
            <div
              className="flex items-center gap-1"
              title={cat.gender === 'female' ? 'Кастрирована' : 'Кастрирован'}
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-medium text-[11px]">
                {cat.gender === 'female' ? 'Кастрирована' : 'Кастрирован'}
              </span>
            </div>
            <div className="flex items-center gap-1.5" title="Совместимость">
              {cat.goodWith?.children && (
                <span title="Дружит с детьми" className="text-stone-500">
                  <Baby className="w-3.5 h-3.5" />
                </span>
              )}
              {cat.goodWith?.otherCats && (
                <span title="Дружит с другими кошками" className="text-stone-500">
                  <CatIcon className="w-3.5 h-3.5" />
                </span>
              )}
              {cat.goodWith?.dogs && (
                <span title="Дружит с собаками" className="text-stone-500">
                  <Dog className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Footer */}
      <div className={`p-5 pt-0 grid ${isAvailable ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
        <a
          id={`view-profile-btn-${cat.id}`}
          href={detailHref}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onViewDetails(cat);
          }}
          className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors text-center flex items-center justify-center gap-1.5"
        >
          {hasVideos && <Video className="w-3.5 h-3.5 text-amber-600" />}
          <span>Анкета и медиа</span>
        </a>

        {isAvailable && (
          <button
            id={`apply-adopt-btn-${cat.id}`}
            onClick={(event) => {
              event.stopPropagation();
              onApplyForAdoption(cat);
            }}
            className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1"
          >
            <span>Забрать</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
};

