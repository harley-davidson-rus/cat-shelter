import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface LightboxMediaItem {
  id: string;
  kind: 'photo' | 'video';
  url: string;
  label?: string;
}

interface MediaLightboxProps {
  items: LightboxMediaItem[];
  initialItemId: string;
  onClose: () => void;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({ items, initialItemId, onClose }) => {
  const initialIndex = Math.max(0, items.findIndex((item) => item.id === initialItemId));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const current = items[activeIndex] || items[0];
  const previous = activeIndex > 0 ? activeIndex - 1 : null;
  const next = activeIndex < items.length - 1 ? activeIndex + 1 : null;

  const accessibleLabel = useMemo(() => current?.label || (current?.kind === 'photo' ? 'Фотография' : 'Видео'), [current]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && previous !== null) setActiveIndex(previous);
      if (event.key === 'ArrowRight' && next !== null) setActiveIndex(next);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [next, onClose, previous]);

  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(Math.max(0, items.length - 1));
  }, [activeIndex, items.length]);

  if (!current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/95 px-3 pb-24 pt-16 backdrop-blur-md sm:px-6 sm:pb-24 sm:pt-16"
      role="dialog"
      aria-modal="true"
      aria-label={`Полноэкранный просмотр: ${accessibleLabel}`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="absolute right-4 top-4 z-20 flex items-center gap-3">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/75">{activeIndex + 1} из {items.length}</span>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20" title="Закрыть (Esc)" aria-label="Закрыть полноэкранный просмотр"><X className="h-6 w-6" /></button>
      </div>

      <div
        className="relative flex h-full w-full touch-pan-y select-none items-center justify-center overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null; }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const touch = event.changedTouches[0];
          touchStart.current = null;
          if (!start || !touch) return;
          const deltaX = touch.clientX - start.x;
          const deltaY = touch.clientY - start.y;
          if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
          if (deltaX < 0 && next !== null) setActiveIndex(next);
          if (deltaX > 0 && previous !== null) setActiveIndex(previous);
        }}
      >
        {current.kind === 'photo' ? (
          <img src={current.url} alt={accessibleLabel} className="max-h-full max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl" />
        ) : (
          <video key={current.id} src={current.url} controls autoPlay playsInline preload="metadata" className="max-h-full max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl" />
        )}

        {previous !== null && <button type="button" onClick={() => setActiveIndex(previous)} className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 sm:flex" aria-label="Предыдущий файл"><ChevronLeft className="h-7 w-7" /></button>}
        {next !== null && <button type="button" onClick={() => setActiveIndex(next)} className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 sm:flex" aria-label="Следующий файл"><ChevronRight className="h-7 w-7" /></button>}
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 overflow-x-auto scroll-smooth rounded-2xl border border-white/10 bg-stone-900/90 p-2" onMouseDown={(event) => event.stopPropagation()}>
          {items.map((item, index) => (
            <button key={item.id} type="button" onClick={() => setActiveIndex(index)} className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 bg-stone-900 transition ${activeIndex === index ? 'scale-105 border-amber-400 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`} aria-label={`Открыть файл ${index + 1}`}>
              {item.kind === 'photo' ? <img src={item.url} alt="" className="h-full w-full object-cover" /> : <><video src={item.url} muted preload="metadata" className="h-full w-full object-cover opacity-60" /><span className="absolute inset-0 flex items-center justify-center"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white shadow-md"><Play className="h-3 w-3 fill-white" /></span></span></>}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
};
