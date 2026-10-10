import React, { useEffect, useRef, useState } from 'react';
import { X, Heart, ShieldCheck, Check, Sparkles, AlertCircle, Baby, Cat as CatIcon, Dog, Calendar, HeartHandshake, Video, Play, Image as ImageIcon, Upload, Edit3, Maximize2 } from 'lucide-react';
import { Cat, CatSize, CatTemperament } from '../types';
import realCatPhoto from '../assets/defaultCat';

interface CatDetailModalProps {
  cat: Cat | null;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onApplyForAdoption: (cat: Cat) => void;
}

const SIZE_LABELS: Record<CatSize, string> = {
  small: 'Миниатюрный',
  medium: 'Средний',
  large: 'Крупный',
};

const TEMPERAMENT_LABELS: Record<CatTemperament, { label: string; desc: string }> = {
  cuddly: { label: 'Ласковый и ручной', desc: 'Обожает сидеть на ручках и громко мурчать' },
  playful: { label: 'Игривый и активный', desc: 'Любит побегать за дразнилкой и полон энергии' },
  calm: { label: 'Спокойный и умиротворяющий', desc: 'Идеальный компаньон для тихих домашних вечеров' },
  independent: { label: 'Независимый', desc: 'Уважает личные границы и ценит спокойствие' },
  curious: { label: 'Любознательный исследователь', desc: 'Интересуется всем вокруг и учится новым трюкам' },
};

export const CatDetailModal: React.FC<CatDetailModalProps> = ({
  cat,
  isFavorite,
  onClose,
  onToggleFavorite,
  onApplyForAdoption,
}) => {
  if (!cat) return null;

  // Viewing mode: 'photo' or 'video'
  const [activeMediaType, setActiveMediaType] = useState<'photo' | 'video'>('photo');
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);
  const [isPhotoFullscreen, setIsPhotoFullscreen] = useState(false);
  const photoTouchStart = useRef<{ x: number; y: number } | null>(null);
  const photoSwipeWidth = useRef(0);
  const photoSwipeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoThumbnailsRef = useRef<HTMLDivElement | null>(null);
  const lightboxThumbnailsRef = useRef<HTMLDivElement | null>(null);
  const [photoSwipeOffset, setPhotoSwipeOffset] = useState(0);
  const [isPhotoSwipeAnimating, setIsPhotoSwipeAnimating] = useState(false);

  const currentVideo = cat.videos?.[activeVideoIdx];
  const currentPhoto = cat.photos[activePhotoIdx] || cat.photos[0] || realCatPhoto;
  const previousPhoto = activePhotoIdx > 0 ? cat.photos[activePhotoIdx - 1] : null;
  const nextPhoto = activePhotoIdx < cat.photos.length - 1 ? cat.photos[activePhotoIdx + 1] : null;
  const photoSwipeTransition = isPhotoSwipeAnimating
    ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
    : 'none';

  const centerPhotoThumbnail = (container: HTMLDivElement | null, photoIndex: number) => {
    const selector = '[data-photo-index="' + photoIndex + '"]';
    const thumbnail = container?.querySelector<HTMLElement>(selector);
    if (!container || !thumbnail) return;
    container.scrollTo({
      left: thumbnail.offsetLeft - (container.clientWidth - thumbnail.clientWidth) / 2,
      behavior: 'smooth',
    });
  };

  const scrollThumbnailStripsTo = (photoIndex: number) => {
    centerPhotoThumbnail(photoThumbnailsRef.current, photoIndex);
    centerPhotoThumbnail(lightboxThumbnailsRef.current, photoIndex);
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollThumbnailStripsTo(activePhotoIdx));
    return () => cancelAnimationFrame(frame);
  }, [activePhotoIdx, isPhotoFullscreen]);

  const resetPhotoTouch = () => {
    photoTouchStart.current = null;
  };

  const finishPhotoSwipe = (direction: 'previous' | 'next' | null) => {
    resetPhotoTouch();
    setIsPhotoSwipeAnimating(true);

    if (!direction) {
      setPhotoSwipeOffset(0);
      photoSwipeTimer.current = setTimeout(() => setIsPhotoSwipeAnimating(false), 220);
      return;
    }

    const targetIndex = direction === 'next'
      ? Math.min(activePhotoIdx + 1, cat.photos.length - 1)
      : Math.max(activePhotoIdx - 1, 0);
    requestAnimationFrame(() => scrollThumbnailStripsTo(targetIndex));

    const distance = photoSwipeWidth.current || window.innerWidth;
    setPhotoSwipeOffset(direction === 'next' ? -distance : distance);
    photoSwipeTimer.current = setTimeout(() => {
      setActivePhotoIdx((index) =>
        direction === 'next'
          ? Math.min(index + 1, cat.photos.length - 1)
          : Math.max(index - 1, 0)
      );
      setPhotoSwipeOffset(0);
      setIsPhotoSwipeAnimating(false);
    }, 220);
  };

  const handlePhotoTouchStart = (event: React.TouchEvent) => {
    if (isPhotoSwipeAnimating) return;
    if (photoSwipeTimer.current) clearTimeout(photoSwipeTimer.current);
    const touch = event.touches[0];
    photoTouchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    photoSwipeWidth.current = event.currentTarget.getBoundingClientRect().width;
    setPhotoSwipeOffset(0);
  };

  const handlePhotoTouchMove = (event: React.TouchEvent) => {
    const start = photoTouchStart.current;
    const touch = event.touches[0];
    if (!start || !touch || isPhotoSwipeAnimating || cat.photos.length < 2) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

    const atEdge =
      (deltaX > 0 && activePhotoIdx === 0) ||
      (deltaX < 0 && activePhotoIdx === cat.photos.length - 1);
    setPhotoSwipeOffset(atEdge ? deltaX * 0.22 : deltaX);
  };

  const handlePhotoTouchEnd = (event: React.TouchEvent) => {
    const start = photoTouchStart.current;
    const touch = event.changedTouches[0];
    if (!start || !touch || cat.photos.length < 2) {
      finishPhotoSwipe(null);
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isHorizontalSwipe = Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

    if (isHorizontalSwipe && deltaX < 0 && nextPhoto) {
      finishPhotoSwipe('next');
    } else if (isHorizontalSwipe && deltaX > 0 && previousPhoto) {
      finishPhotoSwipe('previous');
    } else {
      finishPhotoSwipe(null);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200" onClick={onClose}>
      <div
        id="cat-detail-modal-container"
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header Bar */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <CatIcon className="w-5 h-5" />
            </div>
            <h2 className="min-w-0 truncate font-heading text-base sm:text-lg leading-tight font-bold text-stone-900">
              {cat.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleFavorite(cat.id)}
              className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors"
              title={isFavorite ? 'Удалить из избранного' : 'В избранное'}
            >
              <Heart
                className={`w-5 h-5 ${
                  isFavorite ? 'fill-rose-500 text-rose-500' : 'text-stone-600'
                }`}
              />
            </button>
            <button
              id="close-cat-detail-btn"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Main Hero Media & Quick Bio */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Gallery Column */}
            <div className="md:col-span-6 space-y-3">
              {/* Media viewer (Photo or Video) */}
              <div
                className="aspect-4/3 rounded-2xl overflow-hidden bg-stone-950 shadow-inner relative flex items-center justify-center group touch-pan-y"
                onTouchStart={handlePhotoTouchStart}
                onTouchMove={handlePhotoTouchMove}
                onTouchEnd={handlePhotoTouchEnd}
                onTouchCancel={() => finishPhotoSwipe(null)}
              >
                {activeMediaType === 'video' && currentVideo ? (
                  <video
                    key={currentVideo.url}
                    src={currentVideo.url}
                    controls
                    autoPlay
                    className="w-full h-full object-contain bg-black relative z-10"
                  />
                ) : (
                  <>
                    {/* Atmospheric soft background matching photo colors */}
                    <div
                      className="absolute inset-0 bg-cover bg-center blur-xl opacity-30 scale-110 pointer-events-none"
                      style={{ backgroundImage: `url(${currentPhoto})` }}
                    />

                    {/* Animated swipe track: previous, current and next photo */}
                    {previousPhoto && (
                      <div
                        className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
                        style={{
                          transform: 'translate3d(calc(-100% + ' + photoSwipeOffset + 'px), 0, 0)',
                          transition: photoSwipeTransition,
                        }}
                      >
                        <img src={previousPhoto} alt="" className="max-w-full max-h-full w-auto h-auto object-contain" />
                      </div>
                    )}
                    <div
                      className="absolute inset-0 z-10 flex items-center justify-center cursor-zoom-in"
                      style={{
                        transform: 'translate3d(' + photoSwipeOffset + 'px, 0, 0)',
                        transition: photoSwipeTransition,
                      }}
                      onClick={() => setIsPhotoFullscreen(true)}
                      title="Нажмите, чтобы открыть фото в полном размере"
                    >
                      <img
                        src={currentPhoto}
                        alt={cat.name}
                        draggable={false}
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          if (target.src !== realCatPhoto) target.src = realCatPhoto;
                        }}
                        className="max-w-full max-h-full w-auto h-auto object-contain"
                      />
                    </div>
                    {nextPhoto && (
                      <div
                        className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
                        style={{
                          transform: 'translate3d(calc(100% + ' + photoSwipeOffset + 'px), 0, 0)',
                          transition: photoSwipeTransition,
                        }}
                      >
                        <img src={nextPhoto} alt="" className="max-w-full max-h-full w-auto h-auto object-contain" />
                      </div>
                    )}
                    {/* Fullscreen view button */}
                    <button
                      type="button"
                      onClick={() => setIsPhotoFullscreen(true)}
                      className="absolute top-3 right-3 z-20 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white/90 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-md"
                      title="Полноэкранный просмотр без сжатия"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Media Switcher floating tabs on bottom left of media player */}
                <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-black/70 backdrop-blur-md p-1 rounded-xl">
                  <button
                    onClick={() => setActiveMediaType('photo')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      activeMediaType === 'photo'
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Фото ({cat.photos.length})</span>
                  </button>

                  {cat.videos && cat.videos.length > 0 && (
                    <button
                      onClick={() => setActiveMediaType('video')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        activeMediaType === 'video'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-white/80 hover:text-white'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Видео ({cat.videos.length})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Media Thumbnails Slider */}
              <div ref={photoThumbnailsRef} className="flex gap-2 overflow-x-auto pb-1 scroll-smooth">
                {/* Photo thumbnails */}
                {cat.photos.map((photoUrl, idx) => (
                  <button
                    key={`p-${idx}`}
                    data-photo-index={idx}
                    onClick={() => {
                      setActiveMediaType('photo');
                      setActivePhotoIdx(idx);
                    }}
                    className={`w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition-all relative ${
                      activeMediaType === 'photo' && activePhotoIdx === idx
                        ? 'border-amber-500 scale-105 shadow-md'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={photoUrl || realCatPhoto}
                      alt={`${cat.name} фото ${idx + 1}`}
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        if (target.src !== realCatPhoto) {
                          target.src = realCatPhoto;
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}

                {/* Video thumbnails */}
                {cat.videos?.map((vid, vIdx) => (
                  <button
                    key={vid.id || `v-${vIdx}`}
                    onClick={() => {
                      setActiveMediaType('video');
                      setActiveVideoIdx(vIdx);
                    }}
                    className={`w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition-all relative bg-stone-900 flex items-center justify-center ${
                      activeMediaType === 'video' && activeVideoIdx === vIdx
                        ? 'border-amber-500 scale-105 shadow-md'
                        : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                  >
                    {vid.thumbnail ? (
                      <img
                        src={vid.thumbnail}
                        alt={vid.title}
                        className="w-full h-full object-cover opacity-60"
                      />
                    ) : (
                      <div className="w-full h-full bg-stone-800" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md">
                        <Play className="w-3 h-3 fill-white ml-0.5" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Details Column */}
            <div className="md:col-span-6 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span
                    className={'px-3 py-1 rounded-full text-xs font-bold ' + (
                      cat.status === 'available'
                        ? 'bg-emerald-100 text-emerald-800'
                        : cat.status === 'reserved'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-stone-200 text-stone-700'
                    )}
                  >
                    {cat.status === 'available' ? 'Ищет дом' : cat.status === 'reserved' ? 'На бронировании' : 'Уже дома'}
                  </span>
                  <span className="text-sm font-bold text-amber-600">
                    {cat.gender === 'male' ? 'Мальчик' : 'Девочка'}
                  </span>
                </div>
                <p className="text-stone-500 text-sm mb-4">
                  {cat.breed} • {cat.color}
                </p>

                {/* Size & Temperament Badges */}
                <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-100 mb-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Размер:</span>
                    <strong className="text-stone-800">
                      {SIZE_LABELS[cat.size]}
                      {cat.weightKg ? ` (~${cat.weightKg} кг)` : ''}
                    </strong>
                  </div>
                  <div className="flex items-start justify-between gap-2 border-t border-amber-200/50 pt-2">
                    <span className="text-stone-500 shrink-0">Темперамент:</span>
                    <div className="text-right">
                      <strong className="text-amber-800 block">
                        {TEMPERAMENT_LABELS[cat.temperament].label}
                      </strong>
                      <span className="text-[11px] text-stone-500">
                        {TEMPERAMENT_LABELS[cat.temperament].desc}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-stone-50 rounded-2xl border border-stone-100 mb-4 text-xs">
                  <div>
                    <span className="text-stone-400 block text-[11px]">Возраст</span>
                    <span className="font-bold text-stone-800">{cat.age}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[11px]">Лоток</span>
                    <span className="font-bold text-stone-800">{cat.habits.litterBox}</span>
                  </div>
                </div>

                {/* Character Tags if present */}
                {cat.character && cat.character.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                      Черты характера:
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.character.map((trait, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-xl bg-stone-100 text-stone-800 text-xs font-semibold"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Big CTA inside modal */}
              <div className="pt-2">
                <button
                  id="modal-apply-btn"
                  onClick={() => {
                    onClose();
                    onApplyForAdoption(cat);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <HeartHandshake className="w-5 h-5" />
                  <span>Подать заявку на усыновление {cat.name}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Rescue Story Section */}
          {cat.story ? (
            <div className="p-5 bg-amber-50/40 rounded-2xl border border-amber-100">
              <h3 className="font-heading text-lg font-bold text-stone-900 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                История подопечного
              </h3>
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                {cat.story}
              </p>
            </div>
          ) : (
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-500">
              <span>Реальный подопечный временной передержки. Подробности можно уточнить у куратора при знакомстве или обновить в анкете.</span>
            </div>
          )}

          {/* Health & Veterinary Records */}
          <div className="border border-stone-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-heading text-base font-bold text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Здоровье и ветеринарный контроль
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-50">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Вакцинация:</strong>{' '}
                  {cat.health.vaccinated ? 'Проведена по возрасту' : 'Не проведена'}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-50">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Стерилизация:</strong>{' '}
                  {cat.health.sterilized ? 'Проведена' : 'По возрасту (оплачивает временная передержка)'}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-50">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Обработка:</strong>{' '}
                  {cat.health.parasiteTreated ? 'Проведена' : 'Не проведена'}
                </span>
              </div>
            </div>

            {cat.health.specialNeeds && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl text-amber-900 text-xs mt-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{cat.health.specialNeeds}</span>
              </div>
            )}
          </div>

          {/* Habits & Daily Routine */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 text-xs space-y-2">
              <h4 className="font-bold text-stone-800">Бытовые привычки</h4>
              <p>
                <strong className="text-stone-700">Лоток:</strong> {cat.habits.litterBox}
              </p>
              <p>
                <strong className="text-stone-700">Когтеточка:</strong> {cat.habits.scratchingPost}
              </p>
              <p>
                <strong className="text-stone-700">Питание:</strong> {cat.habits.foodPreference}
              </p>
            </div>

            {/* Compatibility in Family */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 text-xs space-y-2">
              <h4 className="font-bold text-stone-800">Совместимость</h4>
              <div className="flex items-center gap-2">
                <Baby className="w-4 h-4 text-stone-500" />
                <span>
                  С детьми:{' '}
                  <strong>{cat.goodWith.children ? 'Да, отлично ладит' : 'Лучше в семью без маленьких детей'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CatIcon className="w-4 h-4 text-stone-500" />
                <span>
                  С кошками:{' '}
                  <strong>{cat.goodWith.otherCats ? 'Дружелюбен к сородичам' : 'Предпочитает быть единственным любимцем'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Dog className="w-4 h-4 text-stone-500" />
                <span>
                  С собаками:{' '}
                  <strong>{cat.goodWith.dogs ? 'Спокойно относится' : 'Боится лая/собак'}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Bar */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-stone-500">
            Передаётся бесплатно после подписания согласия на ответственное содержание при наличии сеток «Антикошка».
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-200 text-xs font-semibold transition-colors"
            >
              Закрыть
            </button>
            <button
              id="footer-apply-cat-btn"
              onClick={() => {
                onClose();
                onApplyForAdoption(cat);
              }}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors"
            >
              Подать заявку
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox: Uncropped Fullscreen Photo Viewer */}
      {isPhotoFullscreen && (
        <div
          className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={(event) => {
            event.stopPropagation();
            setIsPhotoFullscreen(false);
          }}
        >
          {/* Lightbox Controls */}
          <div className="absolute top-4 right-4 z-70 flex items-center gap-3">
            <span className="text-white/70 text-xs font-medium bg-white/10 px-3 py-1 rounded-full">
              {activePhotoIdx + 1} из {cat.photos.length}
            </span>
            <button
              type="button"
              onClick={() => setIsPhotoFullscreen(false)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Закрыть полноэкранный просмотр (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Animated fullscreen swipe track */}
          <div
            className="relative w-full h-[86vh] overflow-hidden touch-pan-y select-none"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handlePhotoTouchStart}
            onTouchMove={handlePhotoTouchMove}
            onTouchEnd={handlePhotoTouchEnd}
            onTouchCancel={() => finishPhotoSwipe(null)}
          >
            {previousPhoto && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  transform: 'translate3d(calc(-100% + ' + photoSwipeOffset + 'px), 0, 0)',
                  transition: photoSwipeTransition,
                }}
              >
                <img src={previousPhoto} alt="" draggable={false} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10" />
              </div>
            )}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: 'translate3d(' + photoSwipeOffset + 'px, 0, 0)',
                transition: photoSwipeTransition,
              }}
            >
              <img
                src={currentPhoto}
                alt={cat.name}
                draggable={false}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10"
              />
            </div>
            {nextPhoto && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  transform: 'translate3d(calc(100% + ' + photoSwipeOffset + 'px), 0, 0)',
                  transition: photoSwipeTransition,
                }}
              >
                <img src={nextPhoto} alt="" draggable={false} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10" />
              </div>
            )}
          </div>
          {/* Quick thumbnails navigation inside lightbox */}
          {cat.photos.length > 1 && (
            <div
              ref={lightboxThumbnailsRef}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-stone-900/90 rounded-2xl border border-white/10 max-w-[90vw] overflow-x-auto scroll-smooth"
              onClick={(e) => e.stopPropagation()}
            >
              {cat.photos.map((pUrl, pIdx) => (
                <button
                  key={`lb-${pIdx}`}
                  data-photo-index={pIdx}
                  type="button"
                  onClick={() => setActivePhotoIdx(pIdx)}
                  className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                    activePhotoIdx === pIdx
                      ? 'border-amber-400 scale-105 shadow-md'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={pUrl || realCatPhoto}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


