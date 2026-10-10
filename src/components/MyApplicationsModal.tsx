import React from 'react';
import { X, FileText, Calendar, CheckCircle2, Clock, MapPin, Heart, AlertCircle, Send, MessageSquare } from 'lucide-react';
import { AdoptionApplication, ApplicationStatus, SiteContacts } from '../types';

interface MyApplicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  applications: AdoptionApplication[];
  contacts: SiteContacts;
  onOpenAdoptionModal: () => void;
}

export const MyApplicationsModal: React.FC<MyApplicationsModalProps> = ({
  isOpen,
  onClose,
  applications,
  contacts,
  onOpenAdoptionModal,
}) => {
  if (!isOpen) return null;

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'new':
        return {
          label: 'Новая — ожидает звонка куратора',
          className: 'bg-blue-100 text-blue-800 border-blue-200',
          step: 1,
        };
      case 'reviewing':
        return {
          label: 'На рассмотрении куратором',
          className: 'bg-amber-100 text-amber-800 border-amber-200',
          step: 2,
        };
      case 'meeting_scheduled':
        return {
          label: 'Назначено знакомство на передержке!',
          className: 'bg-purple-100 text-purple-800 border-purple-200',
          step: 3,
        };
      case 'approved':
        return {
          label: 'Одобрена! Готовимся к переезду',
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          step: 4,
        };
      case 'rejected':
        return {
          label: 'Отклонена куратором',
          className: 'bg-rose-100 text-rose-800 border-rose-200',
          step: 0,
        };
      default:
        return {
          label: 'В обработке',
          className: 'bg-stone-100 text-stone-800 border-stone-200',
          step: 1,
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200" onClick={onClose}>
      <div
        id="my-applications-modal-container"
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading text-base sm:text-lg leading-tight font-bold text-stone-900">
                Мои заявки на усыновление
              </h3>
              <p className="text-xs text-stone-500">
                История и статус рассмотрения ваших анкет
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-4">
          {applications.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="font-heading font-bold text-lg text-stone-800">
                У вас пока нет отправленных заявок
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Выберите понравившегося котика в каталоге и нажмите кнопку «Подать заявку на усыновление».
              </p>
              <div className="pt-2">
                <button
                  onClick={() => {
                    onClose();
                    onOpenAdoptionModal();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Подать первую заявку
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => {
                const badge = getStatusBadge(app.status);
                return (
                  <div
                    key={app.id}
                    className="p-5 rounded-2xl border border-stone-200 bg-white hover:border-amber-300 transition-colors space-y-4"
                  >
                    {/* Top Row */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {app.catPhoto && (
                          <img
                            src={app.catPhoto}
                            alt={app.catName}
                            className="w-14 h-14 rounded-xl object-cover border border-stone-100 shadow-xs"
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-heading font-extrabold text-base text-stone-900">
                              Подопечный: {app.catName}
                            </h4>
                            <span className="text-xs text-stone-400 font-mono">
                              #{app.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {app.createdAt}
                            </span>
                            <span>Заявитель: {app.applicantName}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Progress tracker steps */}
                    <div className="pt-2 pb-1">
                      <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-medium">
                        <div
                          className={`p-2 rounded-xl border ${
                            badge.step >= 1
                              ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                              : 'bg-stone-50 border-stone-200 text-stone-400'
                          }`}
                        >
                          1. Заявка принята
                        </div>
                        <div
                          className={`p-2 rounded-xl border ${
                            badge.step >= 2
                              ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                              : 'bg-stone-50 border-stone-200 text-stone-400'
                          }`}
                        >
                          2. Звонок куратора
                        </div>
                        <div
                          className={`p-2 rounded-xl border ${
                            badge.step >= 3
                              ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                              : 'bg-stone-50 border-stone-200 text-stone-400'
                          }`}
                        >
                          3. Знакомство на передержке
                        </div>
                        <div
                          className={`p-2 rounded-xl border ${
                            badge.step >= 4
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                              : 'bg-stone-50 border-stone-200 text-stone-400'
                          }`}
                        >
                          4. Домой! 🏠
                        </div>
                      </div>
                    </div>

                    {/* Details Snippet */}
                    <div className="p-3 bg-stone-50 rounded-xl text-xs text-stone-600 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <strong>Контактный телефон:</strong> {app.phone}
                      </div>
                      <div>
                        <strong>Город:</strong> {app.city}
                      </div>
                      <div>
                        <strong>Сетки «Антикошка»:</strong>{' '}
                        {app.hasWindowScreens ? 'Установлены / в процессе' : 'Требуется консультация'}
                      </div>
                      <div>
                        <strong>Другие питомцы:</strong>{' '}
                        {app.hasOtherPets ? app.otherPetsDescription || 'Есть' : 'Нет'}
                      </div>
                    </div>

                    {app.adminNotes && (
                      <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-900 border border-amber-200">
                        <strong>Комментарий куратора передержки:</strong> {app.adminNotes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Contact Box */}
          <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 text-xs text-stone-700 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-stone-900">Есть срочный вопрос по заявке?</p>
              <p className="text-stone-500">
                Куратор на связи ежедневно с 10:00 до 20:00
              </p>
            </div>
            <a
              href={contacts.telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-stone-800 font-semibold hover:border-amber-400 transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5 text-amber-600" />
              <span>{contacts.telegram}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};





