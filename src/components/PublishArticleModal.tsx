import React, { useState, useRef, useEffect } from 'react';
import { X, PenTool, Image as ImageIcon, Calendar, MapPin, Tag, Sparkles, Upload, Images, Trash2, Star, Video, Link } from 'lucide-react';
import { ShelterArticle, ArticleCategory, CatVideo } from '../types';
import { compressImageFile } from '../utils/storage';
import { articleTagSlug, normalizeArticleTag } from '../utils/seo';

interface PublishArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialArticle?: ShelterArticle | null;
  onSave: (article: Omit<ShelterArticle, 'id' | 'publishedAt' | 'likesCount'>) => Promise<void> | void;
}

const SAMPLE_COVERS = [
  'https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&w=1200&q=80',
];

export const PublishArticleModal: React.FC<PublishArticleModalProps> = ({
  isOpen,
  onClose,
  initialArticle,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ArticleCategory>('rescue_story');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState(SAMPLE_COVERS[0]);
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [author, setAuthor] = useState('Команда фонда «Доброта\u00A0для\u00A0кота»');
  const [authorRole, setAuthorRole] = useState('Команда фонда');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('г. Москва, центр фонда «Доброта\u00A0для\u00A0кота»');
  const [tagsInput, setTagsInput] = useState('Доброта\u00A0для\u00A0кота, Кошки, Новости');
  const [readTimeMinutes, setReadTimeMinutes] = useState(3);
  const [fundraisingClosed, setFundraisingClosed] = useState(false);
  const [issueClosed, setIssueClosed] = useState(false);
  const [coverPosition, setCoverPosition] = useState({ x: 50, y: 50 });
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [articleVideos, setArticleVideos] = useState<CatVideo[]>([]);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoTitleInput, setVideoTitleInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const article = initialArticle;
    setTitle(article?.title || '');
    setCategory(article?.category || 'rescue_story');
    setSummary(article?.summary || '');
    setContent(article?.content || '');
    setCoverImage(article?.coverImage || SAMPLE_COVERS[0]);
    setCoverUrlInput('');
    setCoverPosition(article?.coverPosition || { x: 50, y: 50 });
    setGalleryImages(article?.galleryImages || []);
    setArticleVideos(article?.videos || []);
    setVideoUrlInput('');
    setVideoTitleInput('');
    setAuthor(article?.author || 'Команда фонда «Доброта для кота»');
    setAuthorRole(article?.authorRole || 'Команда фонда');
    setEventDate(article?.eventDate || '');
    setEventLocation(article?.eventLocation || 'г. Москва, центр фонда «Доброта для кота»');
    setTagsInput(article?.tags?.join(', ') || 'Доброта для кота, Кошки, Новости');
    setReadTimeMinutes(article?.readTimeMinutes || 3);
    setFundraisingClosed(Boolean(article?.fundraisingClosed));
    setIssueClosed(Boolean(article?.issueClosed));
    setIsSaving(false);
  }, [isOpen, initialArticle]);

  if (!isOpen) return null;

  const handleImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const image = await compressImageFile(file, 1600, 0.82);
      if (!image) throw new Error('Image compression failed');
      setCoverImage(image);
      setCoverUrlInput('');
      setCoverPosition({ x: 50, y: 50 });
    } catch {
      alert('Не удалось обработать фотографию.');
    }
  };

  const readImageFile = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image'));
    reader.onerror = () => reject(reader.error || new Error('Image read failed'));
    reader.readAsDataURL(file);
  });

  const handleGalleryFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (galleryImages.length + files.length > 9) {
      alert('Можно добавить не более 9 дополнительных фотографий.');
      return;
    }
    if (files.some((file) => !file.type.startsWith('image/'))) {
      alert('Выберите только файлы изображений.');
      return;
    }
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 8 * 1024 * 1024) {
      alert('Общий размер выбранных фотографий не должен превышать 8 МБ.');
      return;
    }
    try {
      const images = await Promise.all(files.map((file) => compressImageFile(file, 1600, 0.82)));
      setGalleryImages((prev) => [...prev, ...images]);
    } catch {
      alert('Не удалось прочитать одну из фотографий.');
    }
  };

  const makeGalleryImageMain = (index: number) => {
    const nextCover = galleryImages[index];
    if (!nextCover) return;
    const currentCover = coverUrlInput.trim() || coverImage;
    setGalleryImages((prev) => [currentCover, ...prev.filter((_, imageIndex) => imageIndex !== index)].filter(Boolean).slice(0, 9));
    setCoverImage(nextCover);
    setCoverUrlInput('');
    setCoverPosition({ x: 50, y: 50 });
  };
  const handleVideoFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (articleVideos.length + files.length > 4) {
      alert('Можно добавить не более четырёх видеороликов.');
      return;
    }
    if (files.some((file) => !file.type.startsWith('video/'))) {
      alert('Выберите только видеофайлы MP4, WebM или MOV.');
      return;
    }
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 20 * 1024 * 1024) {
      alert('Общий размер выбранных видео не должен превышать 20 МБ.');
      return;
    }
    try {
      const urls = await Promise.all(files.map(readImageFile));
      const stamp = Date.now();
      const videos = urls.map((url, index): CatVideo => ({
        id: `article-video-${stamp}-${index}`,
        url,
        title: files[index].name.replace(/\.[^/.]+$/, ''),
        duration: 'Видео',
      }));
      setArticleVideos((prev) => [...prev, ...videos]);
    } catch {
      alert('Не удалось прочитать один из видеофайлов.');
    }
  };

  const addVideoByUrl = () => {
    const url = videoUrlInput.trim();
    if (!url) return;
    if (articleVideos.length >= 4) {
      alert('Можно добавить не более четырёх видеороликов.');
      return;
    }
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported protocol');
    } catch {
      alert('Укажите корректную прямую ссылку на видео.');
      return;
    }
    setArticleVideos((prev) => [...prev, {
      id: `article-video-${Date.now()}`,
      url,
      title: videoTitleInput.trim() || 'Видео к новости',
      duration: 'Видео',
    }]);
    setVideoUrlInput('');
    setVideoTitleInput('');
  };

  const insertLinkIntoContent = () => {
    const textarea = contentInputRef.current;
    const selectionStart = textarea?.selectionStart ?? content.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;
    const selectedText = content.slice(selectionStart, selectionEnd);
    const enteredUrl = window.prompt('Вставьте адрес ссылки (https://…):');

    if (enteredUrl === null) return;

    const url = enteredUrl.trim();
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol');
    } catch {
      alert('Укажите корректную ссылку, начинающуюся с http:// или https://.');
      return;
    }

    const label = selectedText || 'текст ссылки';
    const linkMarkup = `[${label.replace(/]/g, '\\]')}](${url})`;
    setContent(`${content.slice(0, selectionStart)}${linkMarkup}${content.slice(selectionEnd)}`);

    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      if (selectedText) {
        const cursorPosition = selectionStart + linkMarkup.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      } else {
        textarea.setSelectionRange(selectionStart + 1, selectionStart + 1 + label.length);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !summary.trim() || !content.trim()) {
      alert('Пожалуйста, заполните заголовок, краткое описание и текст статьи.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(normalizeArticleTag)
      .filter(Boolean)
      .filter((tag, index, allTags) => allTags.findIndex((candidate) => articleTagSlug(candidate) === articleTagSlug(tag)) === index);

    setIsSaving(true);
    try {
      await onSave({
      title: title.trim(),
      category,
      summary: summary.trim(),
      content: content.trim(),
      coverImage: coverUrlInput.trim() || coverImage,
      coverPosition,
      galleryImages,
      videos: articleVideos,
      relatedCatId: initialArticle?.relatedCatId,
      readTimeMinutes: Number(readTimeMinutes) || 3,
      author: author.trim() || 'Команда временной передержки',
      authorRole: authorRole.trim() || 'Волонтёр',
      eventDate: category === 'event' ? eventDate.trim() : undefined,
      eventLocation: category === 'event' ? eventLocation.trim() : undefined,
      fundraisingClosed,
      issueClosed,
        tags: tags.length > 0 ? tags : ['Доброта\u00A0для\u00A0кота'],
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div
        id="publish-article-modal"
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-base sm:text-lg leading-tight font-bold text-stone-900">
                {initialArticle ? 'Редактирование новости' : 'Публикация статьи или новости'}
              </h3>
              <p className="text-xs text-stone-500">
                Поделитесь историей спасения, успехом подопечного или анонсируйте мероприятие
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

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          {/* Category selection */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
              Рубрика статьи *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'rescue_story', label: '🐾 Спасённые кошки', desc: 'История спасения' },
                { id: 'shelter_success', label: '🎉 Успехи передержки', desc: 'Счастливый хвостик' },
                { id: 'resources', label: '📦 Ресурсы и обеспечение', desc: 'Корма, лекарства и сборы' },
                { id: 'event', label: '📅 Мероприятие', desc: 'Выставки и маркеты' },
              ].map((catOption) => (
                <button
                  type="button"
                  key={catOption.id}
                  onClick={() => setCategory(catOption.id as ArticleCategory)}
                  className={`p-3 rounded-2xl text-left border transition-all ${
                    category === catOption.id
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                      : 'border-stone-200 hover:border-stone-300 text-stone-700'
                  }`}
                >
                  <div className="font-bold text-xs">{catOption.label}</div>
                  <div className="text-[11px] text-stone-500">{catOption.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">
              Статус новости
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-3 cursor-pointer hover:border-amber-300">
                <input
                  type="checkbox"
                  checked={fundraisingClosed}
                  onChange={(event) => setFundraisingClosed(event.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                <span className="text-xs font-semibold text-stone-800">Сбор закрыт</span>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-3 cursor-pointer hover:border-amber-300">
                <input
                  type="checkbox"
                  checked={issueClosed}
                  onChange={(event) => setIssueClosed(event.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                <span className="text-xs font-semibold text-stone-800">Вопрос закрыт</span>
              </label>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              Заголовок статьи *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Как маленький рыжик обрёл тёплый дом и верных друзей..."
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500 text-xs sm:text-sm text-stone-900"
            />
          </div>

          {/* Event-specific fields */}
          {category === 'event' && (
            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Параметры мероприятия</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    Дата и время события *
                  </label>
                  <input
                    type="text"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    placeholder="Например: 15 мая 2026, 12:00 – 18:00"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    Место проведения
                  </label>
                  <input
                    type="text"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder={'Например: Главный зал центра «Доброта\u00A0для\u00A0кота»'}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Cover photo */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
              Обложка статьи
            </label>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* Preview */}
              <div className="w-full sm:w-44 aspect-16/10 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                <img
                  src={coverUrlInput.trim() || coverImage}
                  alt="Обложка статьи"
                  style={{ objectPosition: `${coverPosition.x}% ${coverPosition.y}%` }}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 space-y-2.5 w-full">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4 text-stone-600" />
                  <span>Загрузить фото с устройства</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFile}
                />

                <input
                  type="url"
                  value={coverUrlInput}
                  onChange={(e) => setCoverUrlInput(e.target.value)}
                  placeholder="Или вставьте ссылку на изображение..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500"
                />

                {/* Preset covers */}
                <div className="flex gap-2 pt-1">
                  <span className="text-[11px] text-stone-400 self-center">Пресеты:</span>
                  {SAMPLE_COVERS.map((url, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => {
                        setCoverImage(url);
                        setCoverUrlInput('');
                        setCoverPosition({ x: 50, y: 50 });
                      }}
                      className="w-7 h-7 rounded-lg overflow-hidden border border-stone-200 hover:scale-110 transition-transform"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-stone-800">Ракурс фотографии</div>
                  <div className="text-[11px] text-stone-500">Настройте, какая часть изображения будет видна в карточке.</div>
                </div>
                <button type="button" onClick={() => setCoverPosition({ x: 50, y: 50 })} className="px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-[11px] font-bold text-stone-600 hover:bg-stone-100">
                  По центру
                </button>
              </div>
              <label className="block">
                <span className="flex justify-between text-[11px] font-semibold text-stone-600 mb-1"><span>По горизонтали</span><span>{coverPosition.x}%</span></span>
                <input type="range" min={0} max={100} value={coverPosition.x} onChange={(event) => setCoverPosition((prev) => ({ ...prev, x: Number(event.target.value) }))} className="w-full accent-amber-500" />
              </label>
              <label className="block">
                <span className="flex justify-between text-[11px] font-semibold text-stone-600 mb-1"><span>По вертикали</span><span>{coverPosition.y}%</span></span>
                <input type="range" min={0} max={100} value={coverPosition.y} onChange={(event) => setCoverPosition((prev) => ({ ...prev, y: Number(event.target.value) }))} className="w-full accent-amber-500" />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                    <Images className="w-4 h-4 text-amber-600" />
                    Дополнительные фотографии ({galleryImages.length})
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">Можно выбрать несколько файлов одновременно, максимум 9.</div>
                </div>
                <button type="button" onClick={() => galleryInputRef.current?.click()} className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-2">
                  <Upload className="w-4 h-4 text-amber-400" />
                  Добавить фотографии
                </button>
                <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGalleryFiles} className="hidden" />
              </div>

              {galleryImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {galleryImages.map((image, index) => (
                    <div key={`${image.slice(0, 40)}-${index}`} className="relative group aspect-4/3 rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                      <img src={image} alt={`Дополнительная фотография ${index + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent">
                        <button type="button" onClick={() => makeGalleryImageMain(index)} className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-amber-700" title="Сделать главной">
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => setGalleryImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index))} className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-rose-600" title="Удалить фотографию">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                  <Video className="w-4 h-4 text-amber-600" />
                  Видео к новости ({articleVideos.length})
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">До 4 коротких роликов, общий размер выбранных файлов — до 20 МБ.</div>
              </div>
              <button type="button" onClick={() => videoInputRef.current?.click()} className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-400" />
                Загрузить видео
              </button>
              <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" multiple onChange={handleVideoFiles} className="hidden" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <label className="block">
                <span className="block text-[11px] font-semibold text-stone-600 mb-1">Название видео</span>
                <input type="text" value={videoTitleInput} onChange={(event) => setVideoTitleInput(event.target.value)} placeholder="Например: Первые дни в семье" className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs" />
              </label>
              <label className="block">
                <span className="block text-[11px] font-semibold text-stone-600 mb-1">Прямая ссылка</span>
                <input type="url" value={videoUrlInput} onChange={(event) => setVideoUrlInput(event.target.value)} placeholder="https://…/video.mp4" className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs" />
              </label>
              <button type="button" onClick={addVideoByUrl} className="h-9 px-3 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-bold text-stone-700 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5" /> Добавить
              </button>
            </div>

            {articleVideos.length > 0 && (
              <div className="space-y-3">
                {articleVideos.map((video) => (
                  <div key={video.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-3 flex flex-col sm:flex-row gap-3">
                    <video src={video.url} controls preload="metadata" className="w-full sm:w-48 aspect-video rounded-xl bg-black object-contain" />
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-stone-800 truncate">{video.title}</div>
                        <div className="text-[11px] text-stone-500">{video.url.startsWith('data:') ? 'Загруженный файл' : 'Видео по ссылке'}</div>
                      </div>
                      <button type="button" onClick={() => setArticleVideos((prev) => prev.filter((item) => item.id !== video.id))} className="p-2 rounded-lg bg-white border border-stone-200 text-rose-600 hover:bg-rose-50" title="Удалить видео">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Summary */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              Краткое описание (лид) *
            </label>
            <textarea
              required
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="1-2 предложения, привлекающие внимание читателя в ленте..."
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500 text-xs sm:text-sm text-stone-900 resize-none"
            />
          </div>

          {/* Full content */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label htmlFor="article-content" className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Полный текст статьи *
              </label>
              <button
                type="button"
                onClick={insertLinkIntoContent}
                className="px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 text-[11px] font-bold text-stone-700 flex items-center gap-1.5 transition-colors"
                title="Выделите текст, который должен стать ссылкой"
              >
                <Link className="w-3.5 h-3.5" />
                Вставить ссылку
              </button>
            </div>
            <textarea
              id="article-content"
              ref={contentInputRef}
              required
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Подробная история спасения, ход реабилитации, рассказ о переезде в семью или детали программы мероприятия..."
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500 text-xs sm:text-sm text-stone-900 resize-y"
            />
            <p className="mt-1.5 text-[11px] text-stone-500">
              Выделите слова, нажмите «Вставить ссылку» и укажите адрес. Вставленные целиком http/https-ссылки также станут кликабельными.
            </p>
          </div>

          {/* Author info & Read time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 mb-1">
                Автор
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-600 mb-1">
                Должность / роль
              </label>
              <input
                type="text"
                value={authorRole}
                onChange={(e) => setAuthorRole(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-600 mb-1">
                Время чтения (мин)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={readTimeMinutes}
                onChange={(e) => setReadTimeMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              Теги (через запятую)
            </label>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-stone-400 shrink-0" />
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Спасение, Счастливый хвостик, Фестиваль"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl text-xs font-semibold"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors"
            >
              {isSaving ? 'Сохранение…' : initialArticle ? 'Сохранить изменения' : 'Опубликовать материал'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

