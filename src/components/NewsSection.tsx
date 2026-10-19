import React from 'react';
import { Newspaper, PenTool, Calendar, Clock, Heart, ArrowRight, Sparkles, User, Tag } from 'lucide-react';
import { ShelterArticle, ArticleCategory, Cat } from '../types';
import { normalizeArticleTag } from '../utils/seo';
import { PaymentQrImage } from './PaymentQrImage';
import { findSbpPaymentUrl } from '../utils/paymentQr';

interface NewsSectionProps {
  articles: ShelterArticle[];
  likedArticleIds: string[];
  onToggleLike: (id: string) => void;
  onReadArticle: (article: ShelterArticle) => void;
  onOpenPublishModal?: () => void;
  allCats: Cat[];
  getArticleHref?: (article: ShelterArticle) => string;
  activeTag?: string | null;
  getTagHref?: (tag: string) => string;
  onSelectTag?: (tag: string) => void;
  onClearTag?: () => void;
}


const CATEGORY_BADGES: Record<ArticleCategory, { label: string; bg: string }> = {
  rescue_story: { label: 'Спасение', bg: 'bg-emerald-500 text-white' },
  shelter_success: { label: 'Успех', bg: 'bg-amber-500 text-white' },
  event: { label: 'Событие', bg: 'bg-sky-600 text-white' },
};

export const NewsSection: React.FC<NewsSectionProps> = ({
  articles,
  likedArticleIds,
  onToggleLike,
  onReadArticle,
  onOpenPublishModal,
  allCats,
  getArticleHref,
  activeTag,
  getTagHref,
  onSelectTag,
  onClearTag,
}) => {

  return (
    <section className="py-16 bg-stone-100/60 border-t border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div id="news" className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-2">
              <Newspaper className="w-3.5 h-3.5 text-amber-600" />
              <span>Жизнь фонда <span className="whitespace-nowrap">«Доброта&nbsp;для&nbsp;кота»</span></span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Новости, истории и мероприятия
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-2xl">
              Читайте трогательные истории спасения подопечных, радуйтесь счастливым пристройствам и приходите на благотворительные события нашего фонда.
            </p>
          </div>

          {onOpenPublishModal && (
            <button
              id="publish-article-btn"
              onClick={onOpenPublishModal}
              className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2 shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <PenTool className="w-4 h-4 text-amber-400" />
              <span>Опубликовать новость</span>
            </button>
          )}
        </div>

        {activeTag && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-stone-800">
              Публикации по теме <span className="text-amber-700">#{activeTag}</span>
            </p>
            <button
              type="button"
              onClick={onClearTag}
              className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-stone-700 shadow-xs ring-1 ring-stone-200 hover:bg-stone-50"
            >
              Показать все новости
            </button>
          </div>
        )}

        {/* Articles Grid */}
        {articles.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-3xl border border-stone-200">
            <p className="text-stone-500 text-sm">Пока нет публикаций.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {articles.map((article) => {
              const isLiked = likedArticleIds.includes(article.id);
              const badge = CATEGORY_BADGES[article.category] || CATEGORY_BADGES.rescue_story;
              const relatedCat = allCats.find((c) => c.id === article.relatedCatId);

              return (
                <article
                  key={article.id}
                  id={`article-card-${article.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={'Открыть новость: ' + article.title}
                  onClick={() => onReadArticle(article)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onReadArticle(article);
                    }
                  }}
                  className="bg-white rounded-3xl overflow-hidden border border-stone-200/80 shadow-xs hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 transition-all duration-300 flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    {/* Cover image & Category Tag */}
                    <div className="relative aspect-16/10 overflow-hidden bg-stone-100">
                      <PaymentQrImage
                        src={article.coverImage}
                        paymentUrl={findSbpPaymentUrl(article.content)}
                        paymentLinkEnabled={false}
                        alt={article.title}
                        style={{ objectPosition: `${article.coverPosition?.x ?? 50}% ${article.coverPosition?.y ?? 50}%` }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

                      {/* Category Badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs ${badge.bg}`}
                        >
                          {badge.label}
                        </span>

                        {article.category === 'event' && article.eventDate && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/95 text-stone-900 shadow-xs flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-sky-600" />
                            <span>Анонс</span>
                          </span>
                        )}
                      </div>

                      {/* Like button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLike(article.id);
                        }}
                        className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white text-stone-700 shadow-md transition-transform hover:scale-110 active:scale-95"
                        title="Нравится"
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            isLiked ? 'fill-rose-500 text-rose-500' : 'text-stone-600'
                          }`}
                        />
                      </button>

                      {/* Bottom Info on Image */}
                      <div className="absolute bottom-2.5 left-3 right-3 text-white text-[11px] flex items-center justify-between pointer-events-none">
                        <span className="bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md">
                          {article.publishedAt}
                        </span>
                        <span className="bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{article.readTimeMinutes} мин</span>
                        </span>
                      </div>
                    </div>

                    {/* Article Body */}
                    <div className="p-5">
                      {article.category === 'event' && article.eventDate && (
                        <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-100 text-sky-900 text-xs font-semibold flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span>{article.eventDate}</span>
                        </div>
                      )}

                      <h3 className="font-heading text-lg sm:text-xl font-bold text-stone-900 group-hover:text-amber-600 transition-colors mb-2">
                        {article.title}
                      </h3>

                      <p className="text-xs text-stone-500 leading-relaxed whitespace-pre-line mb-4">
                        {article.summary}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {article.tags.slice(0, 3).map((tag, idx) => (
                          <a
                            key={idx}
                            href={getTagHref?.(tag)}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onSelectTag?.(tag);
                            }}
                            className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[11px] font-medium"
                          >
                            #{normalizeArticleTag(tag)}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-5 pt-0 border-t border-stone-100 flex items-center justify-between">
                    <div className="text-[11px] text-stone-400">
                      <span>Автор: </span>
                      <strong className="text-stone-700 font-semibold">{article.author}</strong>
                    </div>

                    <a
                      href={getArticleHref?.(article)}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onReadArticle(article);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-amber-50 hover:text-amber-700 text-stone-700 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <span>Читать</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

