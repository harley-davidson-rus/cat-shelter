import React, { useState } from 'react';
import { Heart, FileText, Cat as CatIcon, Sparkles, Newspaper, Menu, X, ClipboardCheck, Info, MapPin, Lock } from 'lucide-react';

interface NavbarProps {
  favoritesCount: number;
  myApplicationsCount: number;
  onOpenFavorites: () => void;
  onOpenMyApplications: () => void;
  onOpenHelpModal: () => void;
  onOpenAdminDashboard: () => void;
}

const mobileLinkClass = 'flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-700 hover:bg-amber-50 hover:text-amber-700 transition-colors';

export const Navbar: React.FC<NavbarProps> = ({
  favoritesCount,
  myApplicationsCount,
  onOpenFavorites,
  onOpenMyApplications,
  onOpenHelpModal,
  onOpenAdminDashboard,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-100/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 min-[1180px]:h-20 gap-3">
          <a href="#" onClick={closeMobileMenu} className="flex items-center gap-2.5 min-w-0 group">
            <div className="w-10 h-10 min-[1180px]:w-12 min-[1180px]:h-12 rounded-xl min-[1180px]:rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
              <CatIcon className="w-6 h-6 min-[1180px]:w-7 min-[1180px]:h-7 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="font-heading font-extrabold text-sm sm:text-base min-[1180px]:text-xl text-stone-900 tracking-tight flex items-center gap-1 leading-tight whitespace-nowrap">
                Доброта&nbsp;для&nbsp;кота
                <span className="inline-block w-1.5 h-1.5 min-[1180px]:w-2 min-[1180px]:h-2 rounded-full bg-amber-500 shrink-0" />
              </span>
              <p className="text-[11px] text-stone-500 font-medium hidden min-[1180px]:block leading-tight whitespace-nowrap">
                <span>АНО&nbsp;«Фонд помощи животным»</span>
                <span className="block text-stone-500">«Доброта&nbsp;для&nbsp;кота»</span>
              </p>
            </div>
          </a>

          <nav className="hidden min-[1180px]:flex items-center gap-4 min-[1320px]:gap-6 text-sm font-medium text-stone-600" aria-label="Основная навигация">
            <a href="#cats" className="hover:text-amber-600 transition-colors whitespace-nowrap">Анкеты котиков</a>
            <a href="#news" className="hover:text-amber-600 transition-colors whitespace-nowrap">Новости и истории</a>
            <a href="#rules" className="hover:text-amber-600 transition-colors whitespace-nowrap">Как взять котика</a>
            <a href="#about" className="hover:text-amber-600 transition-colors whitespace-nowrap">О передержке</a>
            <a href="#contacts" className="hover:text-amber-600 transition-colors whitespace-nowrap">Контакты</a>
          </nav>

          <div className="hidden min-[1180px]:flex items-center gap-2">
            <button
              id="favorites-button"
              onClick={onOpenFavorites}
              aria-label="Избранные котики"
              title="Избранные котики"
              className="relative p-2.5 rounded-xl border border-stone-200 hover:border-amber-300 hover:bg-amber-50/60 text-stone-700 transition-colors cursor-pointer"
            >
              <Heart className={`w-5 h-5 ${favoritesCount > 0 ? 'fill-rose-500 text-rose-500' : 'text-stone-600'}`} />
              {favoritesCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center shadow-xs">{favoritesCount}</span>
              )}
            </button>
            <button
              id="my-applications-button"
              onClick={onOpenMyApplications}
              className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200 hover:border-amber-300 hover:bg-amber-50/60 text-stone-700 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-4 h-4 text-amber-600" />
              <span>Мои заявки</span>
              {myApplicationsCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold leading-none">{myApplicationsCount}</span>}
            </button>
            <button
              id="help-shelter-button"
              onClick={onOpenHelpModal}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-800 font-semibold text-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Помочь котикам</span>
            </button>
            <button
              id="curator-login-button"
              type="button"
              onClick={onOpenAdminDashboard}
              aria-label="Войти в режим куратора"
              title="Вход для куратора"
              className="w-10 h-10 shrink-0 rounded-xl border border-stone-200 hover:border-amber-300 hover:bg-amber-50 text-stone-600 hover:text-amber-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            className="min-[1180px]:hidden w-11 h-11 shrink-0 rounded-xl border border-stone-200 bg-white hover:bg-amber-50 hover:border-amber-300 text-stone-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div id="mobile-navigation" className="min-[1180px]:hidden pb-4 border-t border-stone-100">
            <nav className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-3" aria-label="Мобильная навигация">
              <a href="#cats" onClick={closeMobileMenu} className={mobileLinkClass}>
                <CatIcon className="w-5 h-5 text-amber-500 shrink-0" />
                <span>Анкеты котиков</span>
              </a>
              <a href="#news" onClick={closeMobileMenu} className={mobileLinkClass}>
                <Newspaper className="w-5 h-5 text-amber-500 shrink-0" />
                <span>Новости и истории</span>
              </a>
              <a href="#rules" onClick={closeMobileMenu} className={mobileLinkClass}>
                <ClipboardCheck className="w-5 h-5 text-amber-500 shrink-0" />
                <span>Как взять котика</span>
              </a>
              <a href="#about" onClick={closeMobileMenu} className={mobileLinkClass}>
                <Info className="w-5 h-5 text-amber-500 shrink-0" />
                <span>О&nbsp;передержке</span>
              </a>
              <a href="#contacts" onClick={closeMobileMenu} className={mobileLinkClass}>
                <MapPin className="w-5 h-5 text-amber-500 shrink-0" />
                <span>Контакты</span>
              </a>
            </nav>

            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => { closeMobileMenu(); onOpenFavorites(); }}
                className="min-h-11 px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Heart className={`w-4 h-4 ${favoritesCount > 0 ? 'fill-rose-500 text-rose-500' : 'text-stone-600'}`} />
                <span>Избранное{favoritesCount > 0 ? ` (${favoritesCount})` : ''}</span>
              </button>
              <button
                type="button"
                onClick={() => { closeMobileMenu(); onOpenMyApplications(); }}
                className="min-h-11 px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-amber-600" />
                <span>Мои заявки{myApplicationsCount > 0 ? ` (${myApplicationsCount})` : ''}</span>
              </button>
              <button
                type="button"
                onClick={() => { closeMobileMenu(); onOpenHelpModal(); }}
                className="col-span-2 min-h-11 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Помочь котикам</span>
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => { closeMobileMenu(); onOpenAdminDashboard(); }}
                className="w-full min-h-11 px-4 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-amber-50 hover:border-amber-300 text-stone-700 hover:text-amber-800 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4 text-amber-600" aria-hidden="true" />
                <span>Вход для куратора</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
