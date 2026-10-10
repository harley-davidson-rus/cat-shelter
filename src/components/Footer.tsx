import React from 'react';
import { Cat as CatIcon, Heart, MapPin, Clock, Send, Lock, Phone, Youtube } from 'lucide-react';
import { SiteContacts, ShelterStats } from '../types';

export const MaxIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
    <rect x="2.5" y="2.5" width="19" height="19" rx="6" stroke="currentColor" strokeWidth="2" />
    <path d="M6.5 16V8l5.5 6 5.5-6v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const VkIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="5" stroke="currentColor" strokeWidth="2" />
    <path d="M5.5 9l3.2 6 3.1-6M13.5 9v6M13.8 12l4-3M13.8 12l4.2 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const RutubeIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="5" stroke="currentColor" strokeWidth="2" />
    <path d="m10 9 5 3-5 3V9Z" fill="currentColor" />
  </svg>
);

const formatSocialUrl = (url: string) =>
  url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');

interface FooterProps {
  contacts: SiteContacts;
  shelterStats: ShelterStats;
  onOpenAdminDashboard?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ contacts, shelterStats, onOpenAdminDashboard }) => {
  return (
    <footer id="contacts" className="bg-stone-900 text-stone-300 pt-16 pb-12 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-stone-800">
          {/* Col 1: Brand & Mission */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                <CatIcon className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <span className="font-heading font-extrabold text-lg text-white tracking-tight block whitespace-nowrap">
                  «Доброта&nbsp;для&nbsp;кота»
                </span>
                <span className="text-[11px] text-stone-400 block font-medium whitespace-nowrap">
                  АНО&nbsp;«Фонд помощи животным <span className="whitespace-nowrap">«Доброта&nbsp;для&nbsp;кота»</span>»
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              Некоммерческая благотворительная организация и центр социализации кошек. Помогаем бездомным и оставленным животным найти ответственных хозяев и обрести безопасный дом.
            </p>

            <div className="pt-2 flex items-center gap-2 text-xs text-amber-400 font-medium">
              <Heart className="w-4 h-4 fill-amber-400" />
              <span>Более {shelterStats.adoptedCount} котиков уже обрели дом</span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="font-heading font-bold text-white text-sm uppercase tracking-wider">
              Навигация
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-stone-400">
              <li>
                <a href="#cats" className="hover:text-amber-400 transition-colors">
                  Каталог анкет котиков
                </a>
              </li>
              <li>
                <a href="#rules" className="hover:text-amber-400 transition-colors">
                  Правила усыновления
                </a>
              </li>
              <li>
                <a href="#about" className="hover:text-amber-400 transition-colors">
                  О временной передержке
                </a>
              </li>
              <li>
                <a href="#contacts" className="hover:text-amber-400 transition-colors">
                  Контакты и визиты
                </a>
              </li>
              {onOpenAdminDashboard && (
                <li>
                  <button
                    onClick={onOpenAdminDashboard}
                    className="hover:text-amber-400 text-stone-400 transition-colors flex items-center gap-1.5 cursor-pointer text-left"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Вход для куратора (панель)</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Col 3: Contacts & Address */}
          <div className="lg:col-span-5 space-y-3">
            <h4 className="font-heading font-bold text-white text-sm uppercase tracking-wider">
              Контакты кураторов
            </h4>

            <ul className="space-y-2.5 text-xs sm:text-sm text-stone-300">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{contacts.address}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{contacts.visitingHours}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-stone-400">Номер телефона:</span>
                <span className="font-medium text-stone-200">{contacts.phone || 'Не указан'}</span>
              </li>
              <li className="grid grid-cols-[1rem_7rem_minmax(0,1fr)] items-center gap-x-2.5">
                <Send className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-stone-400">Telegram-канал:</span>
                <a
                  href={contacts.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 text-amber-400 hover:text-amber-300 hover:underline font-medium transition-colors break-all sm:break-normal"
                >
                  {formatSocialUrl(contacts.telegramUrl)}
                </a>
              </li>
              {contacts.maxUrl && (
                <li className="grid grid-cols-[1rem_7rem_minmax(0,1fr)] items-center gap-x-2.5">
                  <MaxIcon className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-stone-400">MAX:</span>
                  <a
                    href={contacts.maxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 text-amber-400 hover:text-amber-300 hover:underline font-medium transition-colors break-all sm:break-normal"
                  >
                    {formatSocialUrl(contacts.maxUrl)}
                  </a>
                </li>
              )}
              {contacts.vkUrl && (
                <li className="grid grid-cols-[1rem_7rem_minmax(0,1fr)] items-center gap-x-2.5">
                  <VkIcon className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-stone-400">VK:</span>
                  <a
                    href={contacts.vkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 text-amber-400 hover:text-amber-300 hover:underline font-medium transition-colors break-all sm:break-normal"
                  >
                    {formatSocialUrl(contacts.vkUrl)}
                  </a>
                </li>
              )}
              {contacts.youtubeUrl && (
                <li className="grid grid-cols-[1rem_7rem_minmax(0,1fr)] items-center gap-x-2.5">
                  <Youtube className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-stone-400">YouTube:</span>
                  <a
                    href={contacts.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 text-amber-400 hover:text-amber-300 hover:underline font-medium transition-colors break-all sm:break-normal"
                  >
                    {formatSocialUrl(contacts.youtubeUrl)}
                  </a>
                </li>
              )}
              {contacts.rutubeUrl && (
                <li className="grid grid-cols-[1rem_7rem_minmax(0,1fr)] items-center gap-x-2.5">
                  <RutubeIcon className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-stone-400">RUTUBE:</span>
                  <a
                    href={contacts.rutubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 text-amber-400 hover:text-amber-300 hover:underline font-medium transition-colors break-all sm:break-normal"
                  >
                    {formatSocialUrl(contacts.rutubeUrl)}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} АНО&nbsp;«Фонд помощи животным <span className="whitespace-nowrap">«Доброта&nbsp;для&nbsp;кота»</span>». Все права защищены.</p>
          <p className="flex items-center gap-1">
            Сделано с любовью к пушистым сердцам
          </p>
        </div>
      </div>
    </footer>
  );
};












