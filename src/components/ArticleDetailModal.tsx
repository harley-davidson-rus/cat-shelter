import React, { useState } from 'react';
import { X, Calendar, MapPin, Clock, User, Heart, Share2, Sparkles, Tag, ArrowRight } from 'lucide-react';
import { ShelterArticle, Cat } from '../types';
import { ArticleContent } from './ArticleContent';
import { normalizeArticleTag } from '../utils/seo';
import { PaymentQrImage } from './PaymentQrImage';
import { findSbpPaymentUrl } from '../utils/paymentQr';

interface ArticleDetailModalProps {
  article: ShelterArticle | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleLike: (articleId: string) => void;
  isLiked: boolean;
  relatedCat?: Cat | null;
  onViewRelatedCat?: (cat: Cat) => void;
  getTagHref?: (tag: string) => string;
  onSelectTag?: (tag: string) => void;
}

const CATEGORY_STYLES = {
  rescue_story: {
    label: 'Спасённые кошки',
    bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  shelter_success: {
    label: 'Успехи передержки',
    bg: 'bg-amber-100 text-amber-900 border-amber-200',
  },
  resources: {
    label: 'Ресурсы и обеспечение',
    bg: 'bg-violet-100 text-violet-900 border-violet-200',
  },
  event: {
    label: 'Мероприятие',
    bg: 'bg-sky-100 text-sky-900 border-sky-200',
  },
};

export const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({
  article,
  isOpen,
  onClose,
  onToggleLike,
  isLiked,
  relatedCat,
  onViewRelatedCat,
  getTagHref,
  onSelectTag,
}) => {
  if (!isOpen || !article) return null;

  const [copiedNotification, setCopiedNotification] = useState(false);
  const catStyle = CATEGORY_STYLES[article.category] || CATEGORY_STYLES.rescue_story;

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200" onClick={onClose}>
      <div
        id="article-detail-modal"
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Controls */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/70 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${catStyle.bg}`}
            >
              {catStyle.label}
            </span>
            <span className="text-xs text-stone-400">
              {article.publishedAt}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleLike(article.id)}
              className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors flex items-center gap-1.5"
              title="Поставить сердечко"
            >
              <Heart
                className={`w-5 h-5 ${
                  isLiked ? 'fill-rose-500 text-rose-500' : 'text-stone-600'
                }`}
              />
              <span className="text-xs font-bold text-stone-700">
                {(article.likesCount || 0) + (isLiked ? 1 : 0)}
              </span>
            </button>

            <button
              onClick={handleShare}
              className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors"
              title="Скопировать ссылку"
            >
              <Share2 className="w-5 h-5" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* Copied Notice */}
          {copiedNotification && (
            <div className="p-3 bg-stone-900 text-white text-xs rounded-xl text-center font-semibold animate-in fade-in">
              Ссылка скопирована в буфер обмена!
            </div>
          )}

          {/* Cover Hero Photo */}
          <div className="relative aspect-16/9 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
            <PaymentQrImage
              src={article.coverImage}
              paymentUrl={findSbpPaymentUrl(article.content)}
              alt={article.title}
              style={{ objectPosition: `${article.coverPosition?.x ?? 50}% ${article.coverPosition?.y ?? 50}%` }}
              className="w-full h-full object-cover"
            />
          </div>

          {article.galleryImages && article.galleryImages.length > 0 && (
            <div>
              <h2 className="font-heading text-lg font-bold text-stone-900 mb-3">Фотографии</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {article.galleryImages.map((image, index) => (
                  <div key={`${image.slice(0, 40)}-${index}`} className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-50 aspect-4/3">
                    <PaymentQrImage src={image} alt={`${article.title} — фотография ${index + 2}`} className="w-full h-full object-contain" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {article.videos && article.videos.length > 0 && (
            <div>
              <h2 className="font-heading text-lg font-bold text-stone-900 mb-3">Видео</h2>
              <div className="space-y-4">
                {article.videos.map((video) => (
                  <figure key={video.id} className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-950">
                    <video src={video.url} controls preload="metadata" playsInline className="w-full max-h-[34rem] bg-black object-contain" />
                    <figcaption className="px-4 py-3 bg-white text-sm font-semibold text-stone-800">{video.title}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
          {/* Article Title & Metadata */}
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-stone-900 leading-tight mb-3">
              {article.title}
            </h1>

            {(article.fundraisingClosed || article.issueClosed) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {article.fundraisingClosed && (
                  <span className="px-3 py-1.5 rounded-full bg-stone-900 text-white text-xs font-bold">
                    Сбор закрыт
                  </span>
                )}
                {article.issueClosed && (
                  <span className="px-3 py-1.5 rounded-full bg-stone-900 text-white text-xs font-bold">
                    Вопрос закрыт
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-stone-400" />
                <span className="font-medium text-stone-700">{article.author}</span>
                {article.authorRole && (
                  <span className="text-stone-400">({article.authorRole})</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span>Время чтения: {article.readTimeMinutes} мин</span>
              </div>
            </div>
          </div>

          {/* Event Specific Card */}
          {article.category === 'event' && article.eventDate && (
            <div className="p-5 bg-sky-50 rounded-2xl border border-sky-200 text-xs sm:text-sm space-y-2">
              <div className="flex items-center gap-2 font-bold text-sky-900 text-sm">
                <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Дата и время: {article.eventDate}</span>
              </div>
              {article.eventLocation && (
                <div className="flex items-center gap-2 text-stone-700">
                  <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Место: {article.eventLocation}</span>
                </div>
              )}
            </div>
          )}

          {/* Summary Lead */}
          <p className="text-base font-semibold text-stone-800 leading-relaxed bg-amber-50/50 p-4 rounded-2xl border-l-4 border-amber-500">
            {article.summary}
          </p>

          {/* Full Content Text */}
          <div className="text-sm sm:text-base text-stone-700 leading-relaxed whitespace-pre-line space-y-4">
            <ArticleContent content={article.content} />
          </div>

          {/* Connected Cat Banner if applicable */}
          {relatedCat && (
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={relatedCat.photos[0]}
                  alt={relatedCat.name}
                  className="w-14 h-14 rounded-xl object-cover border border-stone-200"
                />
                <div>
                  <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                    Герой этой истории
                  </div>
                  <div className="font-heading font-bold text-stone-900 text-sm">
                    {relatedCat.name} ({relatedCat.age})
                  </div>
                  <div className="text-xs text-stone-500">{relatedCat.breed}</div>
                </div>
              </div>

              {onViewRelatedCat && (
                <button
                  onClick={() => {
                    onClose();
                    onViewRelatedCat(relatedCat);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                >
                  <span>Смотреть анкету</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-4 border-t border-stone-100">
              <Tag className="w-3.5 h-3.5 text-stone-400 mr-1" />
              {article.tags.map((tag, idx) => (
                <a
                  key={idx}
                  href={getTagHref?.(tag)}
                  onClick={(event) => {
                    event.preventDefault();
                    onSelectTag?.(tag);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 text-xs font-medium"
                >
                  #{normalizeArticleTag(tag)}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
          <button
            onClick={() => onToggleLike(article.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              isLiked
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>{isLiked ? 'Вам понравилось' : 'Поддержать историю'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

