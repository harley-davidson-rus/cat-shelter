import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, Cat as CatIcon, CheckCircle2, Image, KeyRound, MessageCircle, Send, Settings, Trash2, Upload, Video } from 'lucide-react';
import { Cat, OwnerContent, OwnerContentKind, UserAccount } from '../types';
import {
  apiChangeAdminPassword,
  apiCreateOwnerContent,
  apiCreateOwnerMediaBatch,
  apiDeleteOwnerContent,
  apiGetAccountCats,
  apiGetOwnerContent,
  apiUpdateAccount,
  apiUpdateOwnerContent,
} from '../utils/api';
import { getCatStatusLabel } from '../utils/catStatus';
import { compressImageFile } from '../utils/storage';
import { PASSWORD_PATTERN, PASSWORD_REQUIREMENTS } from '../utils/password';

interface OwnerDashboardProps {
  user: UserAccount;
  onUserChange: (user: UserAccount) => void;
  initialCatId?: string | null;
  initialContentKind?: Extract<OwnerContentKind, 'photo' | 'video'> | null;
}

const moderationLabel: Record<OwnerContent['moderationStatus'], string> = {
  pending: 'Ожидает проверки',
  approved: 'Опубликовано',
  rejected: 'Отклонено',
};

const kindLabel: Record<OwnerContentKind, string> = {
  photo: 'Фото',
  video: 'Видео',
  comment: 'Комментарий',
  question: 'Вопрос',
};

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ user, onUserChange, initialCatId, initialContentKind }) => {
  const [activeSection, setActiveSection] = useState<'cats' | 'account'>('cats');
  const [cats, setCats] = useState<Cat[]>([]);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [content, setContent] = useState<OwnerContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [draftText, setDraftText] = useState('');
  const [draftKind, setDraftKind] = useState<OwnerContentKind>('question');
  const [draftMedia, setDraftMedia] = useState<string[]>([]);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [isReadingMedia, setIsReadingMedia] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [highlightedContentId, setHighlightedContentId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('ownerContent'));
  const [isConfidential, setIsConfidential] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  const selectedCat = useMemo(() => cats.find((cat) => cat.id === selectedCatId), [cats, selectedCatId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiGetAccountCats()
      .then((loaded) => {
        if (cancelled) return;
        setCats(loaded);
        setSelectedCatId((current) => current || (initialCatId && loaded.some((cat) => cat.id === initialCatId) ? initialCatId : loaded[0]?.id) || '');
      })
      .catch((error) => !cancelled && setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось загрузить котиков' }))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [initialCatId]);

  useEffect(() => {
    if (!selectedCatId) {
      setContent([]);
      return;
    }
    apiGetOwnerContent(selectedCatId).then(setContent).catch(() => setContent([]));
  }, [selectedCatId]);

  useEffect(() => {
    if (!selectedCat) return;
    setDraftKind(selectedCat.status === 'adopted' && initialContentKind ? initialContentKind : selectedCat.status === 'adopted' ? 'comment' : 'question');
    setDraftText('');
    setDraftMedia([]);
    setIsConfidential(false);
  }, [selectedCatId, selectedCat?.status, initialContentKind]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('ownerCapture') !== 'success') return;
    const kind = url.searchParams.get('ownerMedia');
    setMessage({ type: 'success', text: `${kind === 'photo' ? 'Фото отправлено' : 'Видео отправлено'} и появится после проверки куратором.` });
    url.searchParams.delete('ownerCapture');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);

  useEffect(() => {
    if (!highlightedContentId || !content.some((item) => item.id === highlightedContentId)) return;
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`owner-content-${highlightedContentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const url = new URL(window.location.href);
      url.searchParams.delete('ownerContent');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }, 150);
    const highlightTimer = window.setTimeout(() => setHighlightedContentId(null), 3500);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [content, highlightedContentId]);

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    reader.readAsDataURL(file);
  });

  const readVideoDuration = (file: File) => new Promise<number>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => { URL.revokeObjectURL(objectUrl); resolve(video.duration); };
    video.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Не удалось определить длительность видео.')); };
    video.src = objectUrl;
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || !['photo', 'video'].includes(draftKind)) return;
    const expected = draftKind === 'photo' ? 'image/' : 'video/';
    const selected = Array.from(files).filter((file) => file.type.startsWith(expected));
    if (selected.length === 0) {
      setMessage({ type: 'error', text: draftKind === 'photo' ? 'Выберите изображения.' : 'Выберите видеофайлы.' });
      return;
    }
    const availableSlots = 5 - draftMedia.length;
    if (availableSlots <= 0) {
      setMessage({ type: 'error', text: 'За один раз можно отправить не более 5 файлов.' });
      return;
    }
    const accepted = selected.slice(0, availableSlots);
    const maximumFileSize = draftKind === 'photo' ? 25 * 1024 * 1024 : 8 * 1024 * 1024;
    if (accepted.some((file) => file.size > maximumFileSize)) {
      setMessage({ type: 'error', text: `Размер каждого ${draftKind === 'photo' ? 'исходного фото' : 'видео'} не должен превышать ${draftKind === 'photo' ? '25' : '8'} МБ.` });
      return;
    }
    setIsReadingMedia(true);
    setMessage(null);
    try {
      if (draftKind === 'video') {
        const durations = await Promise.all(accepted.map(readVideoDuration));
        if (durations.some((duration) => !Number.isFinite(duration) || duration > 60)) {
          setMessage({ type: 'error', text: 'Можно добавлять только короткие видео длительностью до 60 секунд.' });
          return;
        }
      }
      const urls = draftKind === 'photo'
        ? await Promise.all(accepted.map((file) => compressImageFile(file)))
        : await Promise.all(accepted.map(readFileAsDataUrl));
      setDraftMedia((current) => [...current, ...urls]);
      if (selected.length > availableSlots) setMessage({ type: 'error', text: 'Добавлены первые 5 файлов. Остальные можно отправить следующим сообщением.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось обработать файлы.' });
    } finally {
      setIsReadingMedia(false);
    }
  };

  const openDeviceCamera = () => {
    if (!selectedCat || !['photo', 'video'].includes(draftKind)) return;
    const url = new URL(window.location.href);
    url.searchParams.set('cabinet', '1');
    url.searchParams.set('ownerCat', selectedCat.id);
    url.searchParams.set('ownerMedia', draftKind);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    window.location.assign('/owner-media-capture?catId=' + encodeURIComponent(selectedCat.id) + '&kind=' + draftKind);
  };

  const submitContent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCat) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const created = ['photo', 'video'].includes(draftKind)
        ? await apiCreateOwnerMediaBatch({ catId: selectedCat.id, kind: draftKind as 'photo' | 'video', mediaUrls: draftMedia })
        : [await apiCreateOwnerContent({
            catId: selectedCat.id,
            kind: draftKind,
            text: draftText,
            isConfidential: draftKind === 'question' ? isConfidential : false,
          })];
      setContent((items) => [...items, ...created]);
      setDraftText('');
      setDraftMedia([]);
      setIsConfidential(false);
      setMessage({
        type: 'success',
        text: draftKind === 'question'
          ? 'Вопрос отправлен куратору.'
          : `${created.length > 1 ? 'Файлы отправлены' : 'Материал отправлен'}. Публикация появится после проверки куратором.`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось сохранить материал' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeContent = async (id: string) => {
    if (!(await apiDeleteOwnerContent(id))) return;
    setContent((items) => items.filter((item) => item.id !== id));
  };

  const editComment = async (item: OwnerContent) => {
    const text = window.prompt('Измените комментарий', item.text)?.trim();
    if (!text || text === item.text) return;
    const updated = await apiUpdateOwnerContent(item.id, text);
    setContent((items) => items.map((candidate) => candidate.id === item.id ? updated : candidate));
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      const updated = await apiUpdateAccount(displayName);
      onUserChange(updated);
      setDisplayName(updated.displayName);
      setMessage({ type: 'success', text: 'Отображаемое имя сохранено.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось сохранить имя' });
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      setMessage({ type: 'error', text: 'Новые пароли не совпадают.' });
      return;
    }
    const result = await apiChangeAdminPassword(oldPassword, newPassword);
    if (!result.success) {
      setMessage({ type: 'error', text: result.error || 'Не удалось изменить пароль' });
      return;
    }
    setMessage({ type: 'success', text: 'Пароль изменён. При следующем открытии кабинета войдите заново.' });
    setOldPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-stone-50">
      <div className="px-4 sm:px-8 py-3 border-b border-stone-200 bg-white flex gap-2">
        <button type="button" onClick={() => setActiveSection('cats')} className={'px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ' + (activeSection === 'cats' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700')}>
          <CatIcon className="w-4 h-4" /> Котики
        </button>
        <button type="button" onClick={() => setActiveSection('account')} className={'px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ' + (activeSection === 'account' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700')}>
          <Settings className="w-4 h-4" /> Настройка аккаунта
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        {message && (
          <div className={'mb-4 p-3 rounded-xl text-sm flex items-start gap-2 ' + (message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800')}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
            <span>{message.text}</span>
          </div>
        )}

        {activeSection === 'cats' ? (
          isLoading ? <p className="text-sm text-stone-500">Загружаем котиков…</p> : cats.length === 0 ? (
            <div className="max-w-xl mx-auto py-16 text-center">
              <CatIcon className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h3 className="font-heading text-xl font-black text-stone-900">К аккаунту пока не привязан котик</h3>
              <p className="text-sm text-stone-500 mt-2">Попросите куратора привязать вашего питомца в разделе управления пользователями.</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[240px_1fr] gap-5">
              <aside className="space-y-2">
                {cats.map((cat) => (
                  <button key={cat.id} type="button" onClick={() => setSelectedCatId(cat.id)} className={'w-full p-3 rounded-2xl border text-left flex items-center gap-3 ' + (cat.id === selectedCatId ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-white')}>
                    <img src={cat.photos[0]} alt="" className="w-12 h-12 rounded-xl object-cover" />
                    <span><strong className="block text-sm text-stone-900">{cat.name}</strong><span className="text-xs text-stone-500">{getCatStatusLabel(cat.status, cat.gender)}</span></span>
                  </button>
                ))}
              </aside>

              {selectedCat && (
                <section className="space-y-5">
                  <div className="bg-white border border-stone-200 rounded-2xl p-5">
                    <h3 className="font-heading text-xl font-black text-stone-900">{selectedCat.name}</h3>
                    <p className="text-sm text-stone-600 mt-1">
                      {selectedCat.status === 'trial'
                        ? 'На испытательном сроке можно только задавать вопросы куратору или ветеринару.'
                        : selectedCat.status === 'adopted'
                          ? 'Задавайте вопросы, добавляйте фото, короткие видео и комментарии о жизни дома.'
                          : 'Вы можете задавать вопросы куратору или ветеринару. Фото, видео и комментарии станут доступны после завершения испытательного срока.'}
                    </p>
                  </div>

                  <form onSubmit={submitContent} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {((selectedCat.status === 'adopted' ? ['question', 'comment', 'photo', 'video'] : ['question']) as OwnerContentKind[]).map((kind) => (
                          <button key={kind} type="button" onClick={() => { setDraftKind(kind); setDraftMedia([]); }} className={'px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ' + (draftKind === kind ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-700')}>
                            {kind === 'photo' ? <Image className="w-4 h-4" /> : kind === 'video' ? <Video className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                            {kindLabel[kind]}
                          </button>
                        ))}
                      </div>
                      {['comment', 'question'].includes(draftKind) && (
                        <textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} rows={4} maxLength={5000} placeholder={draftKind === 'question' ? 'Ваш вопрос…' : 'Расскажите, как котик осваивается дома…'} className="w-full p-3 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none" />
                      )}
                      {['photo', 'video'].includes(draftKind) && (
                        <div className="space-y-3">
                          <input
                            ref={mediaInputRef}
                            type="file"
                            multiple
                            accept={draftKind === 'photo' ? 'image/*' : 'video/mp4,video/webm,video/ogg,video/quicktime'}
                            className="hidden"
                            onChange={async (event) => { const input = event.currentTarget; await handleFiles(input.files); input.value = ''; }}
                          />
                          <div className="grid grid-cols-1 gap-2 sm:hidden">
                            <button
                              type="button"
                              onClick={() => !isReadingMedia && openDeviceCamera()}
                              disabled={isReadingMedia || draftMedia.length >= 5}
                              className="min-h-12 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2"
                            >
                              {draftKind === 'photo' ? <Camera className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                              {draftKind === 'photo' ? 'Сделать фото' : 'Записать видео'}
                            </button>
                            <button
                              type="button"
                              onClick={() => !isReadingMedia && mediaInputRef.current?.click()}
                              disabled={isReadingMedia || draftMedia.length >= 5}
                              className="min-h-12 px-4 py-3 rounded-xl border border-stone-300 bg-white hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50 text-stone-800 text-sm font-bold flex items-center justify-center gap-2"
                            >
                              <Upload className="w-5 h-5 text-amber-600" /> Выбрать из галереи
                            </button>
                          </div>
                          <div
                            onClick={() => !isReadingMedia && mediaInputRef.current?.click()}
                            onDragOver={(event) => { event.preventDefault(); setIsDraggingMedia(true); }}
                            onDragLeave={() => setIsDraggingMedia(false)}
                            onDrop={(event) => { event.preventDefault(); setIsDraggingMedia(false); void handleFiles(event.dataTransfer.files); }}
                            className={'hidden sm:block p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-colors ' + (isDraggingMedia ? 'border-amber-500 bg-amber-50' : 'border-stone-300 bg-stone-50 hover:border-amber-400 hover:bg-amber-50/40')}
                          >
                            {isReadingMedia ? <span className="inline-block w-6 h-6 rounded-full border-2 border-amber-600 border-t-transparent animate-spin mb-2" /> : <Upload className="w-7 h-7 mx-auto text-amber-600 mb-2" />}
                            <strong className="block text-sm text-stone-800">{isReadingMedia ? 'Обрабатываем файлы…' : `Выберите или перетащите ${draftKind === 'photo' ? 'фотографии' : 'короткие видео'}`}</strong>
                            <span className="block mt-1 text-xs text-stone-500">Можно выбрать несколько файлов, до 5 за один раз. {draftKind === 'photo' ? 'Фото автоматически сжимаются перед отправкой' : 'Каждое видео — до 8 МБ и до 60 секунд'}.</span>
                          </div>
                          {draftMedia.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {draftMedia.map((url, index) => (
                                <div key={`${url.slice(0, 40)}-${index}`} className="relative aspect-square rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 group">
                                  {draftKind === 'photo'
                                    ? <img src={url} alt={`Выбранное фото ${index + 1}`} className="w-full h-full object-contain" />
                                    : <video src={url} preload="metadata" className="w-full h-full object-contain bg-black" />}
                                  <span className="absolute left-2 top-2 px-2 py-1 rounded-lg bg-black/65 text-white text-[10px] font-bold">{index + 1}</span>
                                  <button type="button" onClick={() => setDraftMedia((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-2 bottom-2 w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg" aria-label={`Удалить файл ${index + 1}`}><Trash2 className="w-4 h-4" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {draftKind === 'question' && (
                        <label className="flex items-start gap-2 text-sm text-stone-700">
                          <input type="checkbox" checked={isConfidential} onChange={(event) => setIsConfidential(event.target.checked)} className="mt-0.5" />
                          Конфиденциальный вопрос — не показывать вопрос и ответ посетителям сайта
                        </label>
                      )}
                      <button disabled={isSubmitting || isReadingMedia || (['photo', 'video'].includes(draftKind) && draftMedia.length === 0)} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2">
                        <Send className="w-4 h-4" /> {draftMedia.length > 1 ? `Отправить выбранные файлы (${draftMedia.length})` : 'Отправить'}
                      </button>
                    </form>

                  <div className="space-y-3">
                    {content.map((item) => (
                      <article id={`owner-content-${item.id}`} key={item.id} className={'bg-white border rounded-2xl p-4 transition-all duration-500 ' + (highlightedContentId === item.id ? 'border-amber-500 ring-4 ring-amber-200 shadow-lg' : 'border-stone-200')}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="text-xs font-bold text-amber-700">{kindLabel[item.kind]}</span>
                          <span className={'text-[11px] font-semibold ' + (item.moderationStatus === 'approved' ? 'text-emerald-700' : item.moderationStatus === 'rejected' ? 'text-rose-700' : 'text-amber-700')}>{moderationLabel[item.moderationStatus]}</span>
                        </div>
                        {item.mediaUrl && (item.kind === 'photo' ? <img src={item.mediaUrl} alt="" className="max-h-72 rounded-xl object-contain bg-stone-100" /> : <video src={item.mediaUrl} controls className="max-h-72 w-full rounded-xl bg-black" />)}
                        {item.text && <p className="text-sm text-stone-700 whitespace-pre-line">{item.text}</p>}
                        {item.answer && <div className="mt-3 p-3 rounded-xl bg-emerald-50 text-sm text-emerald-900"><strong>Ответ:</strong> {item.answer}</div>}
                        {item.kind !== 'question' && (
                          <div className="mt-3 flex gap-2">
                            {item.kind === 'comment' && <button type="button" onClick={() => editComment(item)} className="text-xs font-semibold text-stone-600 hover:text-amber-700">Редактировать</button>}
                            <button type="button" onClick={() => removeContent(item.id)} className="text-xs font-semibold text-rose-600 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Удалить</button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )
        ) : (
          <div className="max-w-xl space-y-5">
            <form onSubmit={saveProfile} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-heading text-lg font-black text-stone-900">Отображаемое имя</h3>
              <p className="text-xs text-stone-500">Имя пользователя: {user.email}</p>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} className="w-full p-3 border border-stone-300 rounded-xl text-sm" />
              <button className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold">Сохранить имя</button>
            </form>
            <form onSubmit={savePassword} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-heading text-lg font-black text-stone-900 flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-600" /> Изменить пароль</h3>
              <input type="password" required value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} placeholder="Текущий пароль" className="w-full p-3 border border-stone-300 rounded-xl text-sm" />
              <input type="password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={200} pattern={PASSWORD_PATTERN} title={PASSWORD_REQUIREMENTS} placeholder="Новый пароль" className="w-full p-3 border border-stone-300 rounded-xl text-sm" />
              <input type="password" required value={newPasswordConfirm} onChange={(event) => setNewPasswordConfirm(event.target.value)} placeholder="Повторите новый пароль" className="w-full p-3 border border-stone-300 rounded-xl text-sm" />
              <p className="text-xs text-stone-500">{PASSWORD_REQUIREMENTS}</p>
              <button className="px-4 py-2 rounded-xl bg-stone-900 text-white text-sm font-bold">Изменить пароль</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
