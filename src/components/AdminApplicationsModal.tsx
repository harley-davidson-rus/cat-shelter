import React, { useState } from 'react';
import { X, ClipboardList, CheckCircle2, Clock, Phone, Mail, Home, Search, MessageSquare, AlertCircle } from 'lucide-react';
import { AdoptionApplication, ApplicationStatus } from '../types';

interface AdminApplicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  applications: AdoptionApplication[];
  onUpdateStatus: (id: string, newStatus: ApplicationStatus, notes?: string) => void;
  onDeleteApplication: (id: string) => void;
}

export const AdminApplicationsModal: React.FC<AdminApplicationsModalProps> = ({
  isOpen,
  onClose,
  applications,
  onUpdateStatus,
  onDeleteApplication,
}) => {
  if (!isOpen) return null;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [curatorNote, setCuratorNote] = useState('');

  const filtered = applications.filter((app) => {
    const matchesSearch =
      app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.catName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.phone.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStartEditNote = (app: AdoptionApplication) => {
    setEditingNotesId(app.id);
    setCuratorNote(app.adminNotes || '');
  };

  const handleSaveNote = (id: string, currentStatus: ApplicationStatus) => {
    onUpdateStatus(id, currentStatus, curatorNote);
    setEditingNotesId(null);
    setCuratorNote('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div
        id="admin-modal-container"
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold">
                Кабинет куратора временной передержки
              </h3>
              <p className="text-xs text-stone-300">
                Управление поступившими заявками на усыновление (всего: {applications.length})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-800 text-stone-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск по имени заявителя, котику или номеру..."
              className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-stone-500 font-medium">Статус:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | ApplicationStatus)}
              className="bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 font-medium text-stone-700 text-xs"
            >
              <option value="all">Все заявки</option>
              <option value="new">Новые</option>
              <option value="reviewing">На рассмотрении</option>
              <option value="meeting_scheduled">Знакомство на передержке</option>
              <option value="approved">Одобренные</option>
              <option value="rejected">Отклонённые</option>
            </select>
          </div>
        </div>

        {/* Applications List */}
        <div className="overflow-y-auto p-6 space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-xs">
              Заявок по заданным критериям не найдено.
            </div>
          ) : (
            filtered.map((app) => (
              <div
                key={app.id}
                className="p-5 rounded-2xl border border-stone-200 bg-white hover:border-amber-300 transition-all space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {app.catPhoto && (
                      <img
                        src={app.catPhoto}
                        alt={app.catName}
                        className="w-12 h-12 rounded-xl object-cover border"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-heading font-extrabold text-base text-stone-900">
                          {app.catName}
                        </h4>
                        <span className="text-xs font-mono text-stone-400">#{app.id}</span>
                        <span className="text-[11px] text-stone-400">• {app.createdAt}</span>
                      </div>
                      <p className="text-xs font-medium text-stone-700">
                        Заявитель: <strong className="text-stone-900">{app.applicantName}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">Изменить статус:</span>
                    <select
                      value={app.status}
                      onChange={(e) =>
                        onUpdateStatus(app.id, e.target.value as ApplicationStatus, app.adminNotes)
                      }
                      className="px-3 py-1.5 rounded-xl border font-bold text-xs bg-stone-50 border-stone-200 focus:outline-none"
                    >
                      <option value="new">Новая</option>
                      <option value="reviewing">На рассмотрении</option>
                      <option value="meeting_scheduled">Знакомство назначено</option>
                      <option value="approved">Одобрена</option>
                      <option value="rejected">Отклонена</option>
                    </select>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-stone-50 rounded-xl text-xs">
                  <div>
                    <span className="text-stone-400 block text-[11px]">Телефон:</span>
                    <a
                      href={`tel:${app.phone}`}
                      className="font-bold text-amber-700 hover:underline"
                    >
                      {app.phone}
                    </a>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[11px]">Email:</span>
                    <span className="font-medium text-stone-800">{app.email}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[11px]">Город / Район:</span>
                    <span className="font-medium text-stone-800">{app.city}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[11px]">Жильё:</span>
                    <span className="font-medium text-stone-800">
                      {app.housingType === 'own_apartment'
                        ? 'Своя квартира'
                        : app.housingType === 'rented_apartment'
                        ? 'Съёмная квартира'
                        : 'Частный дом'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[11px]">Сетки «Антикошка»:</span>
                    <span
                      className={`font-bold ${
                        app.hasWindowScreens ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {app.hasWindowScreens ? 'Есть / установит' : 'Нужна консультация'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[11px]">Другие питомцы:</span>
                    <span className="font-medium text-stone-800">
                      {app.hasOtherPets ? app.otherPetsDescription || 'Есть' : 'Нет'}
                    </span>
                  </div>
                </div>

                {app.comment && (
                  <div className="text-xs p-2.5 bg-amber-50/70 rounded-xl text-stone-800">
                    <strong className="text-stone-700">Комментарий заявителя:</strong> {app.comment}
                  </div>
                )}

                {/* Curator Notes Section */}
                <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100">
                  <div className="flex-1">
                    {editingNotesId === app.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={curatorNote}
                          onChange={(e) => setCuratorNote(e.target.value)}
                          placeholder="Заметка куратора (например: Созвонились, назначили визит на субботу 14:00)..."
                          className="w-full text-xs px-3 py-1.5 border rounded-xl"
                        />
                        <button
                          onClick={() => handleSaveNote(app.id, app.status)}
                          className="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-bold"
                        >
                          Сохранить
                        </button>
                        <button
                          onClick={() => setEditingNotesId(null)}
                          className="px-2 py-1.5 text-xs text-stone-500"
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-stone-400">Заметка куратора:</span>
                        <span className="text-stone-700 font-medium">
                          {app.adminNotes || '— нет заметки'}
                        </span>
                        <button
                          onClick={() => handleStartEditNote(app)}
                          className="text-amber-600 hover:underline font-semibold ml-2"
                        >
                          {app.adminNotes ? 'Изменить' : '+ Добавить заметку'}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Удалить заявку от ${app.applicantName}?`)) {
                        onDeleteApplication(app.id);
                      }
                    }}
                    className="text-[11px] text-rose-500 hover:text-rose-700 font-medium"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

