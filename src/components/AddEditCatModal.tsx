import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Plus, Trash2, Camera, ShieldCheck, Heart, Sparkles, Check, AlertCircle, Image as ImageIcon, Video, Link } from 'lucide-react';
import { Cat, CatGender, CatSize, CatTemperament, AgeCategory, CatStatus, CatVideo } from '../types';
import realCatPhoto from '../assets/defaultCat';
import { compressImageFile } from '../utils/storage';
import { apiVerifyAdminPassword, isAdminAuthenticationError } from '../utils/api';


interface AddEditCatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCat: (catData: Partial<Cat> & { id?: string }) => Promise<void> | void;
  onDeleteCat?: (catId: string) => void;
  initialCat?: Cat | null;
}

export const AddEditCatModal: React.FC<AddEditCatModalProps> = ({
  isOpen,
  onClose,
  onSaveCat,
  onDeleteCat,
  initialCat,
}) => {
  const isEditing = Boolean(initialCat);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [ageCategory, setAgeCategory] = useState<AgeCategory>('adult');
  const [gender, setGender] = useState<CatGender>('male');
  const [size, setSize] = useState<CatSize>('medium');
  const [temperament, setTemperament] = useState<CatTemperament>('calm');
  const [breed, setBreed] = useState('');
  const [color, setColor] = useState('');
  const [story, setStory] = useState('');
  const [activeMediaTab, setActiveMediaTab] = useState<'photos' | 'videos'>('photos');
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<CatVideo[]>([]);
  const [videoTitleInput, setVideoTitleInput] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [isReadingVideo, setIsReadingVideo] = useState(false);
  const [primaryPhotoPosition, setPrimaryPhotoPosition] = useState({ x: 50, y: 30 });
  const [status, setStatus] = useState<CatStatus>('available');
  const [weightKg, setWeightKg] = useState('');
  const [characterText, setCharacterText] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [featured, setFeatured] = useState(false);

  // Health
  const [vaccinated, setVaccinated] = useState(true);
  const [sterilized, setSterilized] = useState(true);
  const [parasiteTreated, setParasiteTreated] = useState(true);
  const [fivFelvNegative, setFivFelvNegative] = useState(true);
  const [specialNeeds, setSpecialNeeds] = useState('');

  // Compatibility
  const [goodWithChildren, setGoodWithChildren] = useState(true);
  const [goodWithCats, setGoodWithCats] = useState(true);
  const [goodWithDogs, setGoodWithDogs] = useState(false);

  // Habits
  const [litterBox, setLitterBox] = useState('Приучен к лотку');
  const [scratchingPost, setScratchingPost] = useState('Приучен к когтеточке');
  const [foodPreference, setFoodPreference] = useState('Качественный сбалансированный корм');

  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReauthOpen, setIsReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState('');
  const [pendingCatData, setPendingCatData] = useState<(Partial<Cat> & { id?: string }) | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Populate form if editing
  useEffect(() => {
    if (initialCat) {
      setName(initialCat.name || '');
      setAge(initialCat.age || '');
      setAgeCategory(initialCat.ageCategory || 'adult');
      setGender(initialCat.gender || 'male');
      setSize(initialCat.size || 'medium');
      setTemperament(initialCat.temperament || 'calm');
      setBreed(initialCat.breed || '');
      setColor(initialCat.color || '');
      setStory(initialCat.story || '');
      setPhotos(initialCat.photos || []);
      setVideos(initialCat.videos || []);
      setPrimaryPhotoPosition(initialCat.primaryPhotoPosition || { x: 50, y: 30 });
      setStatus(initialCat.status || 'available');
      setWeightKg(initialCat.weightKg?.toString() || '');
      setCharacterText((initialCat.character || []).join(', '));
      setArrivalDate(initialCat.arrivalDate || '');
      setFeatured(initialCat.featured ?? false);
      setVaccinated(initialCat.health?.vaccinated ?? true);
      setSterilized(initialCat.health?.sterilized ?? true);
      setParasiteTreated(initialCat.health?.parasiteTreated ?? true);
      setFivFelvNegative(initialCat.health?.fivFelvNegative ?? true);
      setSpecialNeeds(initialCat.health?.specialNeeds || '');
      setGoodWithChildren(initialCat.goodWith?.children ?? true);
      setGoodWithCats(initialCat.goodWith?.otherCats ?? true);
      setGoodWithDogs(initialCat.goodWith?.dogs ?? false);
      setLitterBox(initialCat.habits?.litterBox || 'Приучен к лотку');
      setScratchingPost(initialCat.habits?.scratchingPost || 'Приучен к когтеточке');
      setFoodPreference(initialCat.habits?.foodPreference || 'Качественный сбалансированный корм');
    } else {
      setName('');
      setAge('');
      setAgeCategory('adult');
      setGender('male');
      setSize('medium');
      setTemperament('calm');
      setBreed('Метис');
      setColor('');
      setStory('');
      setPhotos([]);
      setVideos([]);
      setPrimaryPhotoPosition({ x: 50, y: 30 });
      setStatus('available');
      setWeightKg('');
      setCharacterText('');
      setArrivalDate(new Date().getFullYear().toString());
      setFeatured(false);
      setVaccinated(true);
      setSterilized(true);
      setParasiteTreated(true);
      setFivFelvNegative(true);
      setSpecialNeeds('');
      setGoodWithChildren(true);
      setGoodWithCats(true);
      setGoodWithDogs(false);
      setLitterBox('Приучен к лотку');
      setScratchingPost('Приучен к когтеточке');
      setFoodPreference('Качественный сбалансированный корм');
    }
    setErrorMessage(null);
    setActiveMediaTab('photos');
    setVideoTitleInput('');
    setVideoUrlInput('');
    setIsReadingVideo(false);
    setIsSaving(false);
    setIsReauthOpen(false);
    setReauthPassword('');
    setReauthError('');
    setPendingCatData(null);
  }, [initialCat, isOpen]);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    try {
      const compressedUrls = await Promise.all(
        imageFiles.map((file) => compressImageFile(file))
      );
      const validUrls = compressedUrls.filter((url) => Boolean(url));
      if (validUrls.length > 0) {
        setPhotos((prev) => [...prev, ...validUrls]);
      }
    } catch {
      // Fallback: regular read if compression fails
      const newUrls: string[] = [];
      let count = 0;
      imageFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const res = e.target?.result as string;
          if (res) newUrls.push(res);
          count++;
          if (count === imageFiles.length) {
            setPhotos((prev) => [...prev, ...newUrls]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRemovePhoto = (idx: number) => {
    if (!window.confirm(`Удалить фотографию №${idx + 1}?`)) return;
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    if (idx === 0) setPrimaryPhotoPosition({ x: 50, y: 30 });
  };

  const handleSetPrimaryPhoto = (idx: number) => {
    if (idx === 0) return;
    setPhotos((prev) => {
      const copy = [...prev];
      const selected = copy.splice(idx, 1)[0];
      return [selected, ...copy];
    });
    setPrimaryPhotoPosition({ x: 50, y: 30 });
  };

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать видеофайл'));
    reader.readAsDataURL(file);
  });

  const readVideoDuration = (file: File) => new Promise<number>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(objectUrl);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось определить длительность видео'));
    };
    video.src = objectUrl;
  });

  const formatVideoDuration = (durationSeconds: number) => {
    const seconds = Math.max(0, Math.round(durationSeconds));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };

  const handleVideoFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (videos.length >= 20) {
      setErrorMessage('В одной анкете можно сохранить не более 20 видеороликов.');
      return;
    }
    if (!file.type.startsWith('video/')) {
      setErrorMessage('Выберите видеофайл MP4, WebM, OGG или MOV.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('Размер короткого видео не должен превышать 25 МБ.');
      return;
    }
    const inlineVideoBytes = videos.reduce((total, video) =>
      total + (video.url.startsWith('data:') ? Math.ceil(video.url.length * 0.75) : 0), 0);
    if (inlineVideoBytes + file.size > 35 * 1024 * 1024) {
      setErrorMessage('Общий размер загружаемых видео в анкете не должен превышать 35 МБ.');
      return;
    }

    setIsReadingVideo(true);
    setErrorMessage(null);
    try {
      const duration = await readVideoDuration(file);
      if (!Number.isFinite(duration) || duration > 60) {
        setErrorMessage('Можно загружать только короткие видео длительностью до 60 секунд.');
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      setVideos((previous) => [{
        id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url: dataUrl,
        title: file.name.replace(/\.[^/.]+$/, '') || `Видео с ${name.trim() || 'котиком'}`,
        duration: formatVideoDuration(duration),
        thumbnail: photos[0] || '',
        isShort: true,
      }, ...previous]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось добавить видео.');
    } finally {
      setIsReadingVideo(false);
    }
  };

  const handleAddVideoByUrl = () => {
    const url = videoUrlInput.trim();
    if (!url) return;
    if (videos.length >= 20) {
      setErrorMessage('В одной анкете можно сохранить не более 20 видеороликов.');
      return;
    }
    try {
      new URL(url);
    } catch {
      setErrorMessage('Укажите корректную ссылку на видео.');
      return;
    }
    setVideos((previous) => [{
      id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url,
      title: videoTitleInput.trim() || `Видео с ${name.trim() || 'котиком'}`,
      duration: 'Короткое видео',
      thumbnail: photos[0] || '',
      isShort: true,
    }, ...previous]);
    setVideoTitleInput('');
    setVideoUrlInput('');
    setErrorMessage(null);
  };

  const handleRemoveVideo = (videoId: string) => {
    if (!window.confirm('Удалить этот видеоролик из анкеты котика?')) return;
    setVideos((previous) => previous.filter((video) => video.id !== videoId));
  };

  const updatePrimaryPhotoPosition = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    setPrimaryPhotoPosition({ x: Math.round(x), y: Math.round(y) });
  };

  const saveCatData = async (catData: Partial<Cat> & { id?: string }) => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSaveCat(catData);
      onClose();
    } catch (error) {
      if (isAdminAuthenticationError(error)) {
        setPendingCatData(catData);
        setIsReauthOpen(true);
        setReauthPassword('');
        setReauthError('');
      } else {
        setErrorMessage('Не удалось сохранить анкету. Данные остались в форме — попробуйте ещё раз.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Пожалуйста, укажите имя котика (или кличку).');
      return;
    }

    const effectivePhotos = photos.length > 0 ? photos : [realCatPhoto];

    await saveCatData({
      id: initialCat?.id,
      name: name.trim(),
      age: age.trim() || 'Возраст уточняется',
      ageCategory,
      gender,
      size,
      temperament,
      breed: breed.trim() || 'Метис',
      color: color.trim(),
      story: story.trim(),
      photos: effectivePhotos,
      videos,
      primaryPhotoPosition,
      status,
      weightKg: weightKg ? Number(weightKg) : undefined,
      character: characterText
        .split(/[,;]/)
        .map((trait) => trait.trim())
        .filter(Boolean),
      arrivalDate: arrivalDate.trim() || new Date().getFullYear().toString(),
      featured,
      health: {
        vaccinated,
        sterilized,
        parasiteTreated,
        fivFelvNegative,
        specialNeeds: specialNeeds.trim() || undefined,
      },
      goodWith: {
        children: goodWithChildren,
        otherCats: goodWithCats,
        dogs: goodWithDogs,
      },
      habits: {
        litterBox,
        scratchingPost,
        foodPreference: foodPreference.trim() || 'Качественный сбалансированный корм',
      },
    });
  };

  const handleReauthentication = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingCatData || !reauthPassword) return;
    setIsSaving(true);
    setReauthError('');
    const authenticated = await apiVerifyAdminPassword(reauthPassword);
    if (!authenticated) {
      setReauthError('Неверный пароль. Проверьте ввод и попробуйте снова.');
      setIsSaving(false);
      return;
    }
    try {
      await onSaveCat(pendingCatData);
      setIsReauthOpen(false);
      setPendingCatData(null);
      onClose();
    } catch (error) {
      setReauthError(isAdminAuthenticationError(error)
        ? 'Сессия не была восстановлена. Введите пароль ещё раз.'
        : 'Не удалось сохранить анкету. Данные не потеряны, попробуйте ещё раз.');
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div
        id="add-edit-cat-modal"
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {isReauthOpen && (
          <div className="absolute inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleReauthentication} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                <h4 className="font-bold text-stone-900">Сессия куратора истекла</h4>
              </div>
              <p className="text-sm text-stone-600 mb-4">Введите пароль. После входа заполненная анкета сохранится автоматически.</p>
              <input
                type="password"
                value={reauthPassword}
                onChange={(event) => { setReauthPassword(event.target.value); setReauthError(''); }}
                autoFocus
                required
                placeholder="Пароль администратора"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              />
              {reauthError && <p className="mt-2 text-xs text-rose-600">{reauthError}</p>}
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setIsReauthOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-bold">Вернуться к анкете</button>
                <button type="submit" disabled={isSaving} className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold disabled:opacity-60">
                  {isSaving ? 'Сохраняем…' : 'Войти и сохранить'}
                </button>
              </div>
            </form>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-base sm:text-lg leading-tight font-bold text-stone-900">
                {isEditing ? 'Редактировать анкету котика' : 'Добавить реального котика передержки'}
              </h3>
              <p className="text-xs text-stone-500">
                Загрузите свои фотографии и укажите реальные данные
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-stone-700">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Media Tabs */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-1.5">
            <div className="grid grid-cols-2 gap-1" role="tablist" aria-label="Фото и видео котика">
              <button
                type="button"
                role="tab"
                aria-selected={activeMediaTab === 'photos'}
                onClick={() => setActiveMediaTab('photos')}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  activeMediaTab === 'photos'
                    ? 'bg-white text-amber-700 shadow-sm ring-1 ring-stone-200'
                    : 'text-stone-500 hover:bg-white/70 hover:text-stone-800'
                }`}
              >
                <ImageIcon className="h-4 w-4" />
                Фотографии
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600">{photos.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeMediaTab === 'videos'}
                onClick={() => setActiveMediaTab('videos')}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  activeMediaTab === 'videos'
                    ? 'bg-white text-amber-700 shadow-sm ring-1 ring-stone-200'
                    : 'text-stone-500 hover:bg-white/70 hover:text-stone-800'
                }`}
              >
                <Video className="h-4 w-4" />
                Видео
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600">{videos.length}</span>
              </button>
            </div>
          </div>

          {activeMediaTab === 'photos' ? (
            <>
          {/* Photos Upload Section */}
          <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider">
                Реальные фотографии котика
              </label>
              <span className="text-xs text-stone-500">
                {photos.length > 0 ? `Загружено: ${photos.length}` : 'Реальное фото'}
              </span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const input = e.currentTarget;
                await handleFiles(input.files);
                input.value = '';
              }}
            />

            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-amber-500 bg-amber-50/60'
                  : 'border-stone-300 hover:border-amber-400 bg-stone-50/50 hover:bg-amber-50/20'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-bold text-stone-800 text-sm">
                Выберите одну или несколько фотографий
              </p>
              <p className="text-xs text-stone-500 mt-1">
                JPG, PNG и WEBP — изображения сохраняются целиком, без кадрирования
              </p>
            </div>

            {/* Uploaded Photos Grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {photos.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-2xl overflow-hidden border border-stone-200 group bg-stone-100"
                  >
                    <img src={url} alt={`Фото ${idx + 1}`} className="w-full h-full object-contain bg-stone-100" />
                    {idx === 0 && (
                      <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold shadow-xs">
                        Главное фото
                      </span>
                    )}
                    <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1.5 pointer-events-none">

                      {idx !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryPhoto(idx)}
                          title="Сделать главным"
                          aria-label="Сделать фотографию главной"
                          className="w-9 h-9 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg cursor-pointer flex items-center justify-center pointer-events-auto"
                        >
                          <span aria-hidden="true" className="text-base">★</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        title="Удалить фотографию"
                        aria-label="Удалить фотографию"
                        className="w-9 h-9 ml-auto rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-lg cursor-pointer flex items-center justify-center pointer-events-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {photos.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-stone-900 uppercase tracking-wider">Область главного фото</p>
                  <p className="text-xs text-stone-500 mt-1">Нажмите или проведите по превью, чтобы выбрать центр кадра в карточках.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrimaryPhotoPosition({ x: 50, y: 30 })}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                >
                  Сбросить
                </button>
              </div>
              <div
                role="application"
                aria-label="Выбор области главного фото"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updatePrimaryPhotoPosition(event);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) updatePrimaryPhotoPosition(event);
                }}
                onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
                className="relative aspect-4/3 max-w-md overflow-hidden rounded-2xl bg-stone-100 cursor-crosshair select-none touch-none border border-stone-200"
              >
                <img
                  src={photos[0]}
                  alt="Предпросмотр главного фото"
                  draggable={false}
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ objectPosition: primaryPhotoPosition.x + '% ' + primaryPhotoPosition.y + '%' }}
                />
                <span
                  className="absolute w-6 h-6 rounded-full border-2 border-white bg-amber-500/80 shadow-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left: primaryPhotoPosition.x + '%', top: primaryPhotoPosition.y + '%' }}
                />
              </div>
              <p className="text-xs text-stone-500">Оригинал не обрезается. Настройка меняет только положение фото в превью фиксированного размера.</p>
            </div>
          )}

            </>
          ) : (
          <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-900">
                  <Video className="h-4 w-4 text-amber-600" />
                  Короткие видео котика
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  MP4, WebM, OGG или MOV длительностью до 60 секунд и размером до 25 МБ.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                {videos.length}
              </span>
            </div>

            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime"
              className="hidden"
              onChange={async (event) => {
                const input = event.currentTarget;
                await handleVideoFile(input.files);
                input.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => videoFileInputRef.current?.click()}
              disabled={isReadingVideo}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-300 bg-white px-4 py-4 text-sm font-bold text-stone-700 transition hover:border-amber-500 hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
            >
              {isReadingVideo ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                  Обрабатываем видео…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 text-amber-600" />
                  Загрузить короткое видео
                </>
              )}
            </button>

            <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                <Link className="h-3.5 w-3.5 text-stone-400" />
                Или добавить видео по прямой ссылке
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={videoTitleInput}
                  onChange={(event) => setVideoTitleInput(event.target.value)}
                  placeholder="Название видео"
                  className="rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
                <input
                  type="url"
                  value={videoUrlInput}
                  onChange={(event) => setVideoUrlInput(event.target.value)}
                  placeholder="https://…/video.mp4"
                  className="rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddVideoByUrl}
                  disabled={!videoUrlInput.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить ссылку
                </button>
              </div>
            </div>

            {videos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {videos.map((video) => (
                  <div key={video.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                    <div className="aspect-video bg-black">
                      <video
                        src={video.url}
                        controls
                        preload="metadata"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-stone-900">{video.title}</p>
                        {video.duration && <p className="text-[11px] text-stone-400">{video.duration}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVideo(video.id)}
                        className="shrink-0 rounded-lg p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                        title="Удалить видео"
                        aria-label={`Удалить видео «${video.title}»`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Name & Age */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                Имя (кличка) котика *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Реальная кличка"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                Возраст
              </label>
              <input
                type="text"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Например: 1 год, 8 месяцев"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              />
            </div>
          </div>

          {/* Gender & Age Category & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                Пол
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-colors ${
                    gender === 'male'
                      ? 'border-sky-500 bg-sky-50 text-sky-800'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  Мальчик
                </button>
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-colors ${
                    gender === 'female'
                      ? 'border-rose-500 bg-rose-50 text-rose-800'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  Девочка
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                Возрастная категория
              </label>
              <select
                value={ageCategory}
                onChange={(e) => setAgeCategory(e.target.value as AgeCategory)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm bg-white"
              >
                <option value="kitten">Котёнок (до 1 года)</option>
                <option value="young">Молодой (1 – 3 года)</option>
                <option value="adult">Взрослый (3 – 7 лет)</option>
                <option value="senior">Старший (7+ лет)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                Статус
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CatStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm bg-white"
              >
                <option value="available">Ищет дом</option>
                <option value="reserved">На бронировании</option>
                <option value="adopted">Уже дома</option>
              </select>
            </div>
          </div>

          {/* Physical profile */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">Размер</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as CatSize)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm bg-white"
              >
                <option value="small">Маленький</option>
                <option value="medium">Средний</option>
                <option value="large">Крупный</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">Вес, кг</label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="4.2"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">Темперамент</label>
              <select
                value={temperament}
                onChange={(e) => setTemperament(e.target.value as CatTemperament)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm bg-white"
              >
                <option value="cuddly">Ласковый</option>
                <option value="playful">Игривый</option>
                <option value="calm">Спокойный</option>
                <option value="independent">Независимый</option>
                <option value="curious">Любознательный</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">Дата поступления</label>
              <input
                type="text"
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
                placeholder="2026 или 29.09.2026"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="rounded text-amber-500 focus:ring-amber-400"
            />
            <span className="text-xs font-bold text-amber-900">Показывать котика в приоритетных / рекомендуемых</span>
          </label>
          {/* Breed & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                Порода
              </label>
              <input
                type="text"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder="Метис, Европейская короткошёрстная и т.д."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                Окрас
              </label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Рыжий, полосатый, белый..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
              Черты характера
            </label>
            <input
              type="text"
              value={characterText}
              onChange={(e) => setCharacterText(e.target.value)}
              placeholder="Ласковый, общительный, любит играть"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
            />
            <p className="mt-1 text-[11px] text-stone-500">Разделяйте черты запятыми.</p>
          </div>
          {/* Real Story & Description */}
          <div>
            <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
              Реальное описание и особенности котика
            </label>
            <textarea
              rows={3}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Расскажите о характере, повадках, привычках или предыстории появления на передержке..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm leading-relaxed"
            />
          </div>

          {/* Health Checkboxes */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
            <div className="flex items-center gap-2 font-bold text-xs text-stone-800 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Здоровье и ветеринарный статус</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-stone-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vaccinated}
                  onChange={(e) => setVaccinated(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400"
                />
                <span>Вакцинирован по возрасту</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-stone-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sterilized}
                  onChange={(e) => setSterilized(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400"
                />
                <span>Стерилизован / кастрирован</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-stone-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={parasiteTreated}
                  onChange={(e) => setParasiteTreated(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400"
                />
                <span>Обработан от паразитов</span>
              </label>

            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">Особые потребности / лечение</label>
              <textarea
                rows={2}
                value={specialNeeds}
                onChange={(e) => setSpecialNeeds(e.target.value)}
                placeholder="Оставьте пустым, если особых потребностей нет"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
              <h4 className="font-bold text-xs text-stone-800 uppercase tracking-wider">Бытовые привычки</h4>
              <input
                type="text"
                value={litterBox}
                onChange={(e) => setLitterBox(e.target.value)}
                placeholder="Лоток"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs"
              />
              <input
                type="text"
                value={scratchingPost}
                onChange={(e) => setScratchingPost(e.target.value)}
                placeholder="Когтеточка"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs"
              />
              <input
                type="text"
                value={foodPreference}
                onChange={(e) => setFoodPreference(e.target.value)}
                placeholder="Питание"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs"
              />
            </div>
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
              <h4 className="font-bold text-xs text-stone-800 uppercase tracking-wider">Совместимость</h4>
              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-stone-200 cursor-pointer">
                <input type="checkbox" checked={goodWithChildren} onChange={(e) => setGoodWithChildren(e.target.checked)} />
                <span className="text-xs">Ладит с детьми</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-stone-200 cursor-pointer">
                <input type="checkbox" checked={goodWithCats} onChange={(e) => setGoodWithCats(e.target.checked)} />
                <span className="text-xs">Ладит с кошками</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-stone-200 cursor-pointer">
                <input type="checkbox" checked={goodWithDogs} onChange={(e) => setGoodWithDogs(e.target.checked)} />
                <span className="text-xs">Ладит с собаками</span>
              </label>
            </div>
          </div>
          {/* Footer Actions inside Form */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-stone-100">
            {isEditing && onDeleteCat && initialCat && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Удалить анкету котика «${initialCat.name}» из каталога?`)) {
                    onDeleteCat(initialCat.id);
                    onClose();
                  }
                }}
                className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Удалить анкету</span>
              </button>
            )}

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-bold transition-colors"
              >
                Отмена
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                {isSaving ? 'Сохраняем…' : isEditing ? 'Сохранить анкету' : 'Сохранить и добавить анкету'}
              </button>
            </div>
          </div>
        </form>


      </div>
    </div>
  );
};
















