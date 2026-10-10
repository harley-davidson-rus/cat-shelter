import React from 'react';
import { Camera, Car, Heart, MapPin, Package, Phone, QrCode, Send, Sparkles, X, Youtube } from 'lucide-react';
import { Cat, DonationSettings, SiteContacts } from '../types';
import { MaxIcon, RutubeIcon, VkIcon } from './Footer';

const paymentUrl = 'https://qr.nspk.ru/AS1A005DJGHEU5TN8MEQBS8OTS7S95IK?type=01&bank=100000000111&crc=01FA';
const supplies = [
  'Качественные корма и паштеты',
  'Наполнитель и пелёнки 60×90',
  'Когтеточки и прочные переноски',
  'Средства от блох и гельминтов',
];
const volunteerOptions = [
  { label: 'Фотосъёмка котиков', Icon: Camera },
  { label: 'Социализация и игры', Icon: Sparkles },
  { label: 'Автопомощь в ветклиники', Icon: Car },
];
const formatSocialUrl = (url: string) => url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');

export const HelpShelterModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  heroCat?: Cat;
  contacts: SiteContacts;
  donationSettings: DonationSettings;
}> = ({ isOpen, onClose, heroCat, contacts, donationSettings }) => {
  if (!isOpen) return null;
  const photo = heroCat?.photos?.find((item) => item?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-stone-900/65 p-2 backdrop-blur-sm sm:p-3" onClick={onClose}>
      <div
        id="help-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-1.5rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/70 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 id="help-modal-title" className="font-heading text-base font-bold leading-tight text-stone-900 sm:text-lg">
                Как помочь фонду <span className="whitespace-nowrap">«Доброта&nbsp;для&nbsp;кота»</span>
              </h3>
              <p className="text-xs text-stone-500">Любой вклад помогает котикам.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть окно" className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-stone-200">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-3 sm:p-4">
          <div className="grid items-stretch gap-3 md:grid-cols-2 sm:gap-4">
            <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-stone-900 shadow-sm">
              {photo ? (
                <img
                  src={photo}
                  alt={heroCat ? `Котик ${heroCat.name}` : 'Подопечный фонда'}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: `${heroCat?.primaryPhotoPosition?.x ?? 50}% ${heroCat?.primaryPhotoPosition?.y ?? 30}%` }}
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-amber-200 to-orange-300" />
              )}
            </div>

            <section className="flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-3.5 text-center sm:p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
                <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                {donationSettings.title}
              </div>
              <p className="mt-1 text-xs text-stone-600">{donationSettings.description}</p>
              <a href={paymentUrl} target="_blank" rel="noopener noreferrer" aria-label="Открыть оплату через СБП" className="mt-3 block w-36 rounded-2xl border border-stone-200 bg-white p-2.5 shadow-sm transition-transform hover:scale-[1.02] sm:w-44">
                <img src="/images/donation-sbp-qr.svg" alt="QR-код для перевода пожертвования через СБП" className="aspect-square w-full object-contain" />
              </a>
              <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-11 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-600">
                <QrCode className="h-4 w-4" /> Открыть оплату через СБП
              </a>
            </section>
          </div>

          <div className="mt-3 grid items-stretch gap-3 md:grid-cols-2">
            <section className="h-full rounded-2xl border border-stone-200 bg-stone-50 p-3.5">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-900"><Package className="h-4 w-4 text-amber-600" />Посылка с полезными вещами</div>
              <ul className="mt-2 grid gap-x-3 gap-y-1 text-[11px] leading-relaxed text-stone-700 sm:grid-cols-2">{supplies.map((item) => <li key={item}>• {item}</li>)}</ul>
            </section>
            <section className="h-full rounded-2xl border border-stone-200 bg-stone-50 p-3.5">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-900"><Heart className="h-4 w-4 text-rose-500" />Стать волонтёром</div>
              <div className="mt-2 grid gap-1.5 text-[10px] sm:grid-cols-3">{volunteerOptions.map(({ label, Icon }) => (
                <div key={label} className="flex items-center gap-1.5 rounded-xl border border-stone-100 bg-white p-2"><Icon className="h-3.5 w-3.5 shrink-0 text-amber-600" />{label}</div>
              ))}</div>
            </section>
          </div>

          <section className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-stone-800">
            <div className="grid items-start gap-2 sm:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 font-bold text-stone-900"><MapPin className="h-4 w-4 text-amber-600" />Пункт приёма помощи и визиты</div>
                <div className="mt-2 space-y-1">
                  <p className="pl-6">{contacts.address}</p>
                  <p className="pl-6 text-stone-600">{contacts.visitingHours}</p>
                  <div className="flex items-center gap-2 pt-0.5"><Phone className="h-3.5 w-3.5 shrink-0 text-amber-600" /><span><strong>Телефон:</strong> {contacts.phone || 'Не указан'}</span></div>
                </div>
              </div>
              <div className="sm:border-l sm:border-amber-200 sm:pl-4">
                <div className="grid gap-y-1.5 text-[11px]">
                  <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2"><span className="flex items-center gap-1.5 text-stone-600"><Send className="h-3.5 w-3.5 shrink-0 text-amber-600" />Telegram:</span><a href={contacts.telegramUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all font-bold text-amber-900 hover:underline sm:break-normal">{formatSocialUrl(contacts.telegramUrl)}</a></div>
                  <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2"><span className="flex items-center gap-1.5 text-stone-600"><MaxIcon className="h-3.5 w-3.5 shrink-0 text-amber-600" />MAX:</span><a href={contacts.maxUrl || 'https://max.ru/channel_dobrotadylakota'} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all font-bold text-amber-900 hover:underline sm:break-normal">{formatSocialUrl(contacts.maxUrl || 'https://max.ru/channel_dobrotadylakota')}</a></div>
                  <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2"><span className="flex items-center gap-1.5 text-stone-600"><VkIcon className="h-3.5 w-3.5 shrink-0 text-amber-600" />VK:</span><a href={contacts.vkUrl || 'https://vk.ru/dobrota_dlya_kota'} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all font-bold text-amber-900 hover:underline sm:break-normal">{formatSocialUrl(contacts.vkUrl || 'https://vk.ru/dobrota_dlya_kota')}</a></div>
                  <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2"><span className="flex items-center gap-1.5 text-stone-600"><Youtube className="h-3.5 w-3.5 shrink-0 text-amber-600" />YouTube:</span><a href={contacts.youtubeUrl || 'https://www.youtube.com/@dobrota_d_kota'} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all font-bold text-amber-900 hover:underline sm:break-normal">{formatSocialUrl(contacts.youtubeUrl || 'https://www.youtube.com/@dobrota_d_kota')}</a></div>
                  <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2"><span className="flex items-center gap-1.5 text-stone-600"><RutubeIcon className="h-3.5 w-3.5 shrink-0 text-amber-600" />RUTUBE:</span><a href={contacts.rutubeUrl || 'https://rutube.ru/channel/82015606'} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all font-bold text-amber-900 hover:underline sm:break-normal">{formatSocialUrl(contacts.rutubeUrl || 'https://rutube.ru/channel/82015606')}</a></div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
