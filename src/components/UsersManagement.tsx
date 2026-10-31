import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Maximize2, Plus, Save, Search, Send, Trash2, UserCog, Users, X } from 'lucide-react';
import { Cat, OwnerContent, UserAccount, UserRole } from '../types';
import { apiAssignUserCats, apiCreateStaffUser, apiDeleteUser, apiGetPendingOwnerContent, apiGetUsers, apiModerateOwnerContent, apiUpdateUser } from '../utils/api';
import { LightboxMediaItem, MediaLightbox } from './MediaLightbox';

interface UsersManagementProps {
  cats: Cat[];
  currentUser: UserAccount;
  onChangeOwnPassword: () => void;
}

const roleLabel: Record<UserRole, string> = {
  administrator: 'Администратор',
  curator: 'Куратор',
  owner: 'Новый хозяин котика',
};

export const UsersManagement: React.FC<UsersManagementProps> = ({ cats, currentUser, onChangeOwnPassword }) => {
  const currentRole = currentUser.role;
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [pendingContent, setPendingContent] = useState<OwnerContent[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedEmail, setExpandedEmail] = useState('');
  const [draftCatIds, setDraftCatIds] = useState<string[]>([]);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('owner');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ email: '', displayName: '', password: '', role: 'curator' as 'administrator' | 'curator' });
  const [answeringItem, setAnsweringItem] = useState<OwnerContent | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [fullscreenMediaId, setFullscreenMediaId] = useState<string | null>(null);

  const moderationMedia = useMemo<LightboxMediaItem[]>(() => pendingContent
    .filter((item): item is OwnerContent & { kind: 'photo' | 'video'; mediaUrl: string } => Boolean(item.mediaUrl) && (item.kind === 'photo' || item.kind === 'video'))
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      url: item.mediaUrl,
      label: `${item.kind === 'photo' ? 'Фото' : 'Видео'}: ${cats.find((cat) => cat.id === item.catId)?.name || item.catId}`,
    })), [cats, pendingContent]);

  const load = async () => {
    setIsLoading(true);
    try {
      const [loadedUsers, loadedContent] = await Promise.all([apiGetUsers(), apiGetPendingOwnerContent()]);
      setUsers(loadedUsers);
      setPendingContent(loadedContent);
    }
    catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось загрузить пользователей' }); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru-RU');
    return users.filter((user) => !query || user.email.includes(query) || user.displayName.toLocaleLowerCase('ru-RU').includes(query));
  }, [search, users]);

  const getAssignableCats = (user: UserAccount) => {
    const catsAssignedToOtherOwners = new Set(
      users
        .filter((candidate) => candidate.role === 'owner' && candidate.email !== user.email)
        .flatMap((candidate) => candidate.catIds)
    );
    return cats.filter((cat) =>
      (cat.status === 'adopted' || cat.status === 'trial')
      && !catsAssignedToOtherOwners.has(cat.id)
    );
  };

  const openUser = (user: UserAccount) => {
    const isOpening = expandedEmail !== user.email;
    setExpandedEmail(isOpening ? user.email : '');
    const assignableCatIds = new Set(getAssignableCats(user).map((cat) => cat.id));
    setDraftCatIds(isOpening ? user.catIds.filter((catId) => assignableCatIds.has(catId)) : []);
    setEditDisplayName(isOpening ? user.displayName : '');
    setEditRole(user.role);
    setMessage(null);
  };

  const saveCats = async (user: UserAccount) => {
    try {
      const updated = await apiAssignUserCats(user.email, draftCatIds);
      setUsers((items) => items.map((item) => item.email === updated.email ? updated : item));
      setMessage({ type: 'success', text: `Котики для ${updated.displayName} сохранены.` });
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось сохранить связи' }); }
  };

  const removeUser = async (user: UserAccount) => {
    if (!window.confirm(`Удалить пользователя ${user.email}?`)) return;
    try {
      await apiDeleteUser(user.email);
      setUsers((items) => items.filter((item) => item.email !== user.email));
      if (expandedEmail === user.email) setExpandedEmail('');
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось удалить пользователя' }); }
  };

  const saveUser = async (user: UserAccount) => {
    try {
      const isCurrentUser = user.email === currentUser.email;
      const updated = await apiUpdateUser(user.email, { displayName: editDisplayName, role: isCurrentUser ? user.role : editRole });
      setUsers((items) => items.map((item) => item.email === updated.email ? updated : item));
      setDraftCatIds(updated.catIds);
      setMessage({ type: 'success', text: `Пользователь ${updated.email} обновлён.` });
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось обновить пользователя' }); }
  };

  const createStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      const created = await apiCreateStaffUser(staffForm);
      setUsers((items) => [...items, created]);
      setStaffForm({ email: '', displayName: '', password: '', role: 'curator' });
      setIsCreateOpen(false);
      setMessage({ type: 'success', text: 'Учётная запись сотрудника создана.' });
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось создать сотрудника' }); }
  };

  const moderate = async (item: OwnerContent, status: OwnerContent['moderationStatus'], answer?: string) => {
    try {
      const updated = await apiModerateOwnerContent(item.id, status, answer);
      if (updated.moderationStatus === 'pending' || (updated.kind === 'question' && !updated.answer)) {
        setPendingContent((items) => items.map((candidate) => candidate.id === updated.id ? updated : candidate));
      } else {
        setPendingContent((items) => items.filter((candidate) => candidate.id !== updated.id));
      }
      setMessage({
        type: 'success',
        text: item.kind === 'question' && answer
          ? 'Ответ отправлен пользователю.'
          : status === 'approved' ? 'Материал одобрен.' : 'Материал отклонён.',
      });
      return true;
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось обработать материал' });
      return false;
    }
  };

  const openAnswerForm = (item: OwnerContent) => {
    setAnsweringItem(item);
    setAnswerText(item.answer || '');
    setMessage(null);
  };

  const closeAnswerForm = () => {
    if (isSubmittingAnswer) return;
    setAnsweringItem(null);
    setAnswerText('');
  };

  const submitAnswer = async (event: React.FormEvent) => {
    event.preventDefault();
    const answer = answerText.trim();
    if (!answeringItem || !answer) return;
    setIsSubmittingAnswer(true);
    try {
      if (await moderate(answeringItem, 'approved', answer)) {
        setAnsweringItem(null);
        setAnswerText('');
      }
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-stone-50">
      {fullscreenMediaId && <MediaLightbox items={moderationMedia} initialItemId={fullscreenMediaId} onClose={() => setFullscreenMediaId(null)} />}
      {answeringItem && (
        <div className="fixed inset-0 z-[80] bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAnswerForm(); }}>
          <form onSubmit={submitAnswer} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-stone-200 shadow-2xl">
            <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 border-b border-stone-200 bg-white flex items-start justify-between gap-4">
              <div>
                <h4 className="font-heading text-xl font-black text-stone-900">Ответ пользователю</h4>
                <p className="text-xs text-stone-500 mt-1">Ответ появится в личном кабинете владельца.</p>
              </div>
              <button type="button" onClick={closeAnswerForm} disabled={isSubmittingAnswer} className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-50" aria-label="Закрыть форму ответа"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <strong className="text-sm text-amber-950">{cats.find((cat) => cat.id === answeringItem.catId)?.name || answeringItem.catId} · {answeringItem.authorDisplayName}</strong>
                  {answeringItem.isConfidential && <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700 text-[11px] font-bold">Конфиденциальный вопрос</span>}
                </div>
                <p className="text-sm leading-relaxed text-stone-800 whitespace-pre-line">{answeringItem.text}</p>
              </div>

              <label className="block">
                <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">Ваш ответ</span>
                <textarea
                  autoFocus
                  required
                  rows={8}
                  maxLength={5000}
                  value={answerText}
                  onChange={(event) => setAnswerText(event.target.value)}
                  placeholder="Напишите понятный и подробный ответ пользователю…"
                  className="w-full min-h-48 resize-y rounded-2xl border border-stone-300 bg-stone-50 p-4 text-sm leading-relaxed text-stone-900 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
                <span className="mt-1.5 block text-right text-[11px] text-stone-400">{answerText.length} / 5000</span>
              </label>
            </div>

            <div className="sticky bottom-0 px-5 sm:px-6 py-4 border-t border-stone-200 bg-white flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button type="button" onClick={closeAnswerForm} disabled={isSubmittingAnswer} className="px-5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-sm font-bold disabled:opacity-50">Отмена</button>
              <button type="submit" disabled={isSubmittingAnswer || !answerText.trim()} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"><Send className="w-4 h-4" /> {isSubmittingAnswer ? 'Отправляем…' : 'Отправить ответ'}</button>
            </div>
          </form>
        </div>
      )}
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <h4 className="font-heading text-xl font-black text-stone-900 flex items-center gap-2"><Users className="w-5 h-5 text-amber-600" /> Пользователи</h4>
            <p className="text-xs text-stone-500 mt-1">Управление доступом и привязкой новых хозяев к котикам.</p>
          </div>
          {currentRole === 'administrator' && <button type="button" onClick={() => setIsCreateOpen((open) => !open)} className="px-4 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-bold flex items-center justify-center gap-2"><Plus className="w-4 h-4 text-amber-400" /> Добавить сотрудника</button>}
        </div>

        {message && <div className={'p-3 rounded-xl text-sm flex items-center gap-2 ' + (message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800')}>{message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{message.text}</div>}

        {pendingContent.length > 0 && (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
            <div><h5 className="font-bold text-amber-950">Требуют реакции: {pendingContent.length}</h5><p className="text-xs text-amber-800">Материалы владельцев ожидают модерации или ответа.</p></div>
            {pendingContent.map((item) => {
              const cat = cats.find((candidate) => candidate.id === item.catId);
              return <article key={item.id} className="bg-white rounded-xl border border-amber-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2"><strong className="text-sm text-stone-900">{cat?.name || item.catId} · {item.authorDisplayName}</strong><span className="text-xs font-bold text-amber-700">{item.kind === 'question' ? 'Вопрос' : item.kind === 'comment' ? 'Комментарий' : item.kind === 'photo' ? 'Фото' : 'Видео'}</span></div>
                {item.text && <p className="text-sm text-stone-700 whitespace-pre-line mb-2">{item.text}</p>}
                {item.mediaUrl && (item.kind === 'photo' ? (
                  <button type="button" onClick={() => setFullscreenMediaId(item.id)} className="group relative mb-2 block max-w-full overflow-hidden rounded-lg bg-stone-100" title="Открыть на весь экран">
                    <img src={item.mediaUrl} alt="" className="max-h-48 max-w-full object-contain" />
                    <span className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-xl bg-black/65 text-white shadow-lg transition group-hover:bg-black/80"><Maximize2 className="h-4 w-4" /></span>
                  </button>
                ) : (
                  <div className="relative mb-2 inline-block max-w-full overflow-hidden rounded-lg bg-black">
                    <video src={item.mediaUrl} controls preload="metadata" className="max-h-48 max-w-full" />
                    <button type="button" onClick={() => setFullscreenMediaId(item.id)} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-xl bg-black/65 text-white shadow-lg transition hover:bg-black/80" title="Открыть на весь экран" aria-label="Открыть видео на весь экран"><Maximize2 className="h-4 w-4" /></button>
                  </div>
                ))}
                {item.isConfidential && <p className="text-xs text-rose-700 mb-2">Конфиденциальный вопрос</p>}
                <div className="flex gap-2"><button type="button" onClick={() => item.kind === 'question' ? openAnswerForm(item) : moderate(item, 'approved')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">{item.kind === 'question' ? 'Ответить' : 'Одобрить'}</button><button type="button" onClick={() => moderate(item, 'rejected')} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold">Отклонить</button></div>
              </article>;
            })}
          </section>
        )}

        {isCreateOpen && (
          <form onSubmit={createStaff} className="bg-white border border-stone-200 rounded-2xl p-4 grid sm:grid-cols-2 gap-3">
            <input type="email" required value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} placeholder="E-mail сотрудника" className="p-3 border border-stone-300 rounded-xl text-sm" />
            <input required value={staffForm.displayName} onChange={(event) => setStaffForm({ ...staffForm, displayName: event.target.value })} placeholder="Отображаемое имя" className="p-3 border border-stone-300 rounded-xl text-sm" />
            <input type="password" required minLength={8} maxLength={200} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])[A-Za-z0-9]{8,200}" title="Минимум 8 символов: строчные и заглавные латинские буквы и цифры, без специальных символов" value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} placeholder="Временный пароль" className="p-3 border border-stone-300 rounded-xl text-sm" />
            <select value={staffForm.role} onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value as 'administrator' | 'curator' })} className="p-3 border border-stone-300 rounded-xl text-sm"><option value="curator">Куратор</option><option value="administrator">Администратор</option></select>
            <p className="sm:col-span-2 text-[11px] text-stone-500">Пароль: минимум 8 символов, буквы a-z и A-Z и цифры. Специальные символы нельзя использовать.</p>
            <button className="sm:col-span-2 justify-self-start px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold">Создать</button>
          </form>
        )}

        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по e-mail или имени" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm" />
        </div>

        {isLoading ? <p className="text-sm text-stone-500">Загрузка…</p> : filteredUsers.map((user) => (
          <article key={user.email} className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <button type="button" onClick={() => openUser(user)} className="w-full p-4 text-left flex items-center gap-3 hover:bg-stone-50">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><UserCog className="w-5 h-5" /></div>
              <div className="min-w-0 flex-1"><strong className="block text-sm text-stone-900 truncate">{user.displayName}</strong><span className="block text-xs text-stone-500 truncate">{user.email}</span></div>
              <div className="text-right"><span className="block text-xs font-bold text-stone-700">{roleLabel[user.role]}</span><span className={'text-[11px] ' + (user.isVerified ? 'text-emerald-700' : 'text-amber-700')}>{user.isVerified ? 'Регистрация подтверждена' : 'Ожидает подтверждения'}</span></div>
            </button>
            {expandedEmail === user.email && (
              <div className="border-t border-stone-100 p-4 bg-stone-50 space-y-4">
                {user.email === currentUser.email && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div>
                      <p className="text-xs font-bold text-amber-950">Безопасность вашей учётной записи</p>
                      <p className="mt-0.5 text-[11px] text-amber-800">Пароль может изменить только владелец текущей учётной записи.</p>
                    </div>
                    <button type="button" onClick={onChangeOwnPassword} className="px-4 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-bold flex items-center justify-center gap-2"><KeyRound className="w-4 h-4 text-amber-400" /> Изменить пароль</button>
                  </div>
                )}
                {currentRole === 'administrator' && <div className="grid sm:grid-cols-[1fr_220px_auto] gap-2 items-end">
                  <label className="space-y-1"><span className="block text-xs font-bold text-stone-600">Отображаемое имя</span><input value={editDisplayName} onChange={(event) => setEditDisplayName(event.target.value)} maxLength={120} className="w-full p-2.5 rounded-xl border border-stone-200 bg-white text-sm" /></label>
                  <label className="space-y-1"><span className="block text-xs font-bold text-stone-600">Роль</span><select value={editRole} disabled={user.email === currentUser.email} onChange={(event) => setEditRole(event.target.value as UserRole)} title={user.email === currentUser.email ? 'Свою роль изменить нельзя' : undefined} className="w-full p-2.5 rounded-xl border border-stone-200 bg-white text-sm disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed"><option value="administrator">Администратор</option><option value="curator">Куратор</option><option value="owner">Новый хозяин котика</option></select></label>
                  <button type="button" onClick={() => saveUser(user)} className="px-4 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-bold flex items-center justify-center gap-2"><Save className="w-4 h-4 text-amber-400" /> Сохранить пользователя</button>
                </div>}
                {user.role === 'owner' && <>
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wide text-stone-600 mb-2">Привязанные котики</h5>
                    {getAssignableCats(user).length > 0 ? (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {getAssignableCats(user).map((cat) => <label key={cat.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-stone-200 text-sm"><input type="checkbox" checked={draftCatIds.includes(cat.id)} onChange={(event) => setDraftCatIds((ids) => event.target.checked ? [...ids, cat.id] : ids.filter((id) => id !== cat.id))} /> <span className="truncate">{cat.name}</span></label>)}
                      </div>
                    ) : (
                      <p className="p-3 rounded-xl border border-stone-200 bg-white text-xs text-stone-500">Нет свободных котиков со статусом «Нашёл дом» или «На испытательном сроке».</p>
                    )}
                  </div>
                  <button type="button" onClick={() => saveCats(user)} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold flex items-center gap-2"><Save className="w-4 h-4" /> Сохранить котиков</button>
                </>}
                {((user.role === 'owner' && !user.isVerified) || (currentRole === 'administrator' && user.role !== 'administrator')) && <button type="button" onClick={() => removeUser(user)} className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2"><Trash2 className="w-4 h-4" /> {user.role === 'owner' && !user.isVerified ? 'Сбросить попытку регистрации' : 'Удалить пользователя'}</button>}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
};
