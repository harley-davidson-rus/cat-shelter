import React, { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { CatFilter } from './components/CatFilter';
import { CatCard } from './components/CatCard';
import { NewsSection } from './components/NewsSection';
import { AdoptionRulesSection } from './components/AdoptionRulesSection';
import { ShelterAboutSection } from './components/ShelterAboutSection';
import { Footer } from './components/Footer';
import { SHELTER_INFO } from './data/cats';
import { INITIAL_ARTICLES } from './data/news';
import { Cat, AdoptionApplication, FilterOptions, ApplicationStatus, ShelterArticle, ShelterStats, SiteContacts, DonationSettings } from './types';
import { Sparkles, Heart, Search, Check, AlertCircle, Plus, Download, Upload, ArrowUp } from 'lucide-react';
import { cleanupOldStorageKeys } from './utils/storage';
import {
  articleSeoPath,
  articleTagPath,
  catSeoPath,
  findArticleTagBySlug,
  findBySeoSlug,
  normalizeArticleTag,
} from './utils/seo';
import { sortArticlesNewestFirst } from './utils/articles';
import {
  apiGetCats,
  apiGetBootstrap,
  apiSaveCat,
  apiDeleteCat,
  apiGetAdminApplications,
  apiCreateApplication,
  apiUpdateApplication,
  apiDeleteApplication,
  apiGetArticles,
  apiPublishArticle,
  apiUpdateArticle,
  apiDeleteArticle,
  apiLikeArticle,
  apiSaveSetting,
  apiUpdateShelterStats,
  apiUpdateSiteContacts,
  apiDownloadDatabaseBackup,
  apiImportDatabaseBackup,
  apiGetCatRatings,
  apiRecordVisit,
  apiGetVisitAnalytics,
  CatRating,
  VisitAnalytics,
} from './utils/api';

const CatDetailModal = lazy(() => import('./components/CatDetailModal').then((module) => ({ default: module.CatDetailModal })));
const AddEditCatModal = lazy(() => import('./components/AddEditCatModal').then((module) => ({ default: module.AddEditCatModal })));
const AdoptionModal = lazy(() => import('./components/AdoptionModal').then((module) => ({ default: module.AdoptionModal })));
const MyApplicationsModal = lazy(() => import('./components/MyApplicationsModal').then((module) => ({ default: module.MyApplicationsModal })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const FavoritesModal = lazy(() => import('./components/FavoritesModal').then((module) => ({ default: module.FavoritesModal })));
const ArticleDetailModal = lazy(() => import('./components/ArticleDetailModal').then((module) => ({ default: module.ArticleDetailModal })));
const PublishArticleModal = lazy(() => import('./components/PublishArticleModal').then((module) => ({ default: module.PublishArticleModal })));
const HelpShelterModal = lazy(() => import('./components/HelpShelterModal').then((module) => ({ default: module.HelpShelterModal })));



const getLocalDateKey = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
};

let visitRecordedForThisPageLoad = false;

export default function App() {
  // Cats catalog state: loaded from computer server database
  const [cats, setCats] = useState<Cat[]>([]);

  useEffect(() => {
    if (visitRecordedForThisPageLoad) return;
    visitRecordedForThisPageLoad = true;
    apiRecordVisit().catch(() => {});
  }, []);
  const [catsLoaded, setCatsLoaded] = useState(false);
  const [heroDateKey, setHeroDateKey] = useState(getLocalDateKey);

  useEffect(() => {
    const timer = window.setInterval(() => setHeroDateKey(getLocalDateKey()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const dailyHeroCat = useMemo(() => {
    const catsWithPhotos = cats
      .filter((cat) => cat.photos?.some((photo) => typeof photo === 'string' && photo.trim() && !photo.includes('/src/assets/')))
      .sort((left, right) => left.id.localeCompare(right.id));
    const candidates = catsWithPhotos.length > 0
      ? catsWithPhotos
      : [...cats].sort((left, right) => left.id.localeCompare(right.id));
    if (candidates.length === 0) return undefined;

    const [year, month, day] = heroDateKey.split('-').map(Number);
    const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
    return candidates[dayNumber % candidates.length];
  }, [cats, heroDateKey]);

  // Articles & stories state: loaded from computer server database
  const [articles, setArticles] = useState<ShelterArticle[]>(() => INITIAL_ARTICLES);
  const [shelterStats, setShelterStats] = useState<ShelterStats>({
    adoptedCount: SHELTER_INFO.stats.adoptedCount,
    currentCount: SHELTER_INFO.stats.currentCount,
  });
  const [siteContacts, setSiteContacts] = useState<SiteContacts>({
    address: SHELTER_INFO.address,
    visitingHours: SHELTER_INFO.visitingHours,
    phone: SHELTER_INFO.phone,
    telegram: SHELTER_INFO.telegram,
    telegramUrl: SHELTER_INFO.telegramUrl,
    maxUrl: SHELTER_INFO.maxUrl,
    vkUrl: SHELTER_INFO.vkUrl,
    youtubeUrl: SHELTER_INFO.youtubeUrl,
    rutubeUrl: SHELTER_INFO.rutubeUrl,
  });

  const [donationSettings, setDonationSettings] = useState<DonationSettings>({
    title: 'Помочь переводом',
    description: 'Отсканируйте QR-код в мобильном приложении банка.',
    image: '/images/donation-qr.jpg',
  });

  // Liked article IDs
  const [likedArticleIds, setLikedArticleIds] = useState<string[]>(['art-1']);

  // Favorites state
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // Applications state: loaded from computer server database
  const [applications, setApplications] = useState<AdoptionApplication[]>([]);
  const [adminApplications, setAdminApplications] = useState<AdoptionApplication[]>([]);
  const [catRatings, setCatRatings] = useState<CatRating[]>([]);
  const [visitAnalytics, setVisitAnalytics] = useState<VisitAnalytics | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter state (including age, gender, size, temperament)
  const defaultFilters: FilterOptions = {
    search: '',
    gender: 'all',
    ageCategory: 'all',
    size: 'all',
    temperament: 'all',
    goodWithChildren: false,
    goodWithCats: false,
    goodWithDogs: false,
    vaccinatedOnly: false,
    sterilizedOnly: false,
    status: 'all',
  };
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);

  // Modal states
  const [selectedCatForDetail, setSelectedCatForDetail] = useState<Cat | null>(null);
  const [selectedCatForAdoption, setSelectedCatForAdoption] = useState<Cat | null>(null);
  // Add/Edit Cat Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Cat | null>(null);
  const [newlyAddedCatId, setNewlyAddedCatId] = useState<string | null>(null);

  const [selectedArticleForDetail, setSelectedArticleForDetail] = useState<ShelterArticle | null>(null);
  const [selectedArticleTag, setSelectedArticleTag] = useState<string | null>(null);
  const [isPublishArticleModalOpen, setIsPublishArticleModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ShelterArticle | null>(null);
  const [newlyAddedArticleId, setNewlyAddedArticleId] = useState<string | null>(null);

  const [isAdoptionModalOpen, setIsAdoptionModalOpen] = useState(false);
  const [isMyApplicationsModalOpen, setIsMyApplicationsModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const openCatDetail = (cat: Cat, updateHistory = true) => {
    const targetPath = catSeoPath(cat, cats);
    setSelectedArticleForDetail(null);
    setSelectedArticleTag(null);
    setSelectedCatForDetail(cat);
    if (updateHistory && window.location.pathname !== targetPath) {
      window.history.pushState({ shelterDetail: true }, '', targetPath);
    }
  };

  const openArticleDetail = (article: ShelterArticle, updateHistory = true) => {
    const targetPath = articleSeoPath(article, articles);
    setSelectedCatForDetail(null);
    setSelectedArticleTag(null);
    setSelectedArticleForDetail(article);
    if (updateHistory && window.location.pathname !== targetPath) {
      window.history.pushState({ shelterDetail: true }, '', targetPath);
    }
  };

  const openArticleTag = (tag: string, updateHistory = true) => {
    const normalizedTag = normalizeArticleTag(tag);
    if (!normalizedTag) return;
    const targetPath = articleTagPath(normalizedTag);
    setSelectedCatForDetail(null);
    setSelectedArticleForDetail(null);
    setSelectedArticleTag(normalizedTag);
    if (updateHistory && window.location.pathname !== targetPath) {
      window.history.pushState({ shelterTag: true }, '', targetPath);
    }
    window.setTimeout(() => document.getElementById('news')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const clearArticleTag = () => {
    setSelectedArticleTag(null);
    window.history.pushState(null, '', '/#news');
  };

  const leaveDetailPath = (anchor: '#cats' | '#news') => {
    if (window.history.state?.shelterDetail) {
      window.history.back();
    } else {
      window.history.replaceState(null, '', '/' + anchor);
    }
  };

  const closeCatDetail = () => {
    setSelectedCatForDetail(null);
    leaveDetailPath('#cats');
  };

  const closeArticleDetail = () => {
    setSelectedArticleForDetail(null);
    leaveDetailPath('#news');
  };

  useEffect(() => {
    if (!catsLoaded) return;

    const syncDetailWithAddress = () => {
      const tagMatch = window.location.pathname.match(/^\/news\/tag\/([^/]+)\/?$/);
      if (tagMatch) {
        const tag = findArticleTagBySlug(tagMatch[1], articles);
        setSelectedArticleTag(tag || null);
        setSelectedCatForDetail(null);
        setSelectedArticleForDetail(null);
        return;
      }

      const catMatch = window.location.pathname.match(/^\/cats\/([^/]+)\/?$/);
      if (catMatch) {
        const cat = findBySeoSlug(catMatch[1], cats, (candidate) => candidate.name, 'kotik');
        setSelectedCatForDetail(cat || null);
        setSelectedArticleForDetail(null);
        setSelectedArticleTag(null);
        return;
      }

      const articleMatch = window.location.pathname.match(/^\/news\/([^/]+)\/?$/);
      if (articleMatch) {
        const article = findBySeoSlug(articleMatch[1], articles, (candidate) => candidate.title, 'novost');
        setSelectedArticleForDetail(article || null);
        setSelectedCatForDetail(null);
        setSelectedArticleTag(null);
        return;
      }

      setSelectedCatForDetail(null);
      setSelectedArticleForDetail(null);
      setSelectedArticleTag(null);
    };

    syncDetailWithAddress();
    window.addEventListener('popstate', syncDetailWithAddress);
    return () => window.removeEventListener('popstate', syncDetailWithAddress);
  }, [articles, cats, catsLoaded]);

  useEffect(() => {
    const homeTitle = 'Взять котика из приюта в Санкт-Петербурге — Доброта для кота';
    const homeDescription = 'Котики из фонда помощи животным «Доброта для кота» ищут семью в Санкт-Петербурге. Посмотрите анкеты и подайте заявку на усыновление.';
    const title = selectedCatForDetail
      ? selectedCatForDetail.name + ' ищет дом в Санкт-Петербурге — Доброта для кота'
      : selectedArticleForDetail
        ? selectedArticleForDetail.title + ' — Доброта для кота'
        : selectedArticleTag
          ? '#' + selectedArticleTag + ' — новости фонда «Доброта для кота»'
          : homeTitle;
    const description = selectedCatForDetail
      ? (selectedCatForDetail.story || selectedCatForDetail.breed + ', ' + selectedCatForDetail.age).slice(0, 180)
      : selectedArticleForDetail
        ? selectedArticleForDetail.summary.slice(0, 180)
        : selectedArticleTag
          ? 'Новости, истории и мероприятия фонда «Доброта для кота» по теме «' + selectedArticleTag + '».'
          : homeDescription;
    const canonical = 'https://kind4cat.ru' + (
      selectedCatForDetail
        ? catSeoPath(selectedCatForDetail, cats)
        : selectedArticleForDetail
          ? articleSeoPath(selectedArticleForDetail, articles)
          : selectedArticleTag
            ? articleTagPath(selectedArticleTag)
            : '/'
    );

    document.title = title;
    const descriptionElement = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const canonicalElement = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    let keywordsElement = document.querySelector<HTMLMetaElement>('meta[name="keywords"]');
    const keywords = selectedArticleForDetail?.tags?.map(normalizeArticleTag).filter(Boolean)
      || (selectedArticleTag ? [selectedArticleTag] : []);
    if (keywords.length && !keywordsElement) {
      keywordsElement = document.createElement('meta');
      keywordsElement.name = 'keywords';
      document.head.appendChild(keywordsElement);
    }
    if (keywordsElement) {
      if (keywords.length) keywordsElement.content = keywords.join(', ');
      else keywordsElement.remove();
    }
    if (descriptionElement) descriptionElement.content = description;
    if (canonicalElement) canonicalElement.href = canonical;
    if (ogTitle) ogTitle.content = title;
    if (ogDescription) ogDescription.content = description;
    if (ogUrl) ogUrl.content = canonical;
  }, [articles, cats, selectedArticleForDetail, selectedArticleTag, selectedCatForDetail]);

  // On mount: cleanup obsolete browser storage and load all records from local computer database file
  useEffect(() => {
    cleanupOldStorageKeys();

    const loadDataFromComputerDatabase = async () => {
      try {
        const {
          cats: serverCats,
          applications: serverApps,
          articles: serverArts,
          preferences: serverSettings,
          shelterStats: serverShelterStats,
          siteContacts: serverSiteContacts,
          donationSettings: serverDonationSettings,
        } = await apiGetBootstrap();

        const loadedCats = Array.isArray(serverCats) ? serverCats : [];

        if (Array.isArray(serverCats)) {
          setCats(serverCats);
        }
        if (serverApps && Array.isArray(serverApps)) {
          setApplications(serverApps);
        }
        if (serverArts && Array.isArray(serverArts)) {
          setArticles(serverArts);
        }
        if (serverShelterStats) {
          setShelterStats(serverShelterStats);
        }
        if (serverSiteContacts) {
          setSiteContacts({
            ...serverSiteContacts,
            rutubeUrl: serverSiteContacts.rutubeUrl || SHELTER_INFO.rutubeUrl,
          });
        }
        if (serverDonationSettings) {
          setDonationSettings(serverDonationSettings);
        }
        if (serverSettings) {
          if (Array.isArray(serverSettings.favorites)) {
            const validFavoriteIds = serverSettings.favorites.filter(
              (id): id is string => typeof id === 'string' && loadedCats.some((cat) => cat.id === id)
            );
            setFavoriteIds(validFavoriteIds);
            if (validFavoriteIds.length !== serverSettings.favorites.length) {
              apiSaveSetting('favorites', validFavoriteIds).catch(() => {});
            }
          }
          if (Array.isArray(serverSettings.likedArticleIds)) {
            setLikedArticleIds(serverSettings.likedArticleIds);
          }

        }
      } catch (err) {
        console.error('Error loading data from computer database:', err);
      } finally {
        setCatsLoaded(true);
      }
    };

    loadDataFromComputerDatabase();
  }, []);

  // Show temporary toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Toggle favorite (saved to computer database)
  const handleToggleFavorite = (catId: string) => {
    setFavoriteIds((prev) => {
      const exists = prev.includes(catId);
      const cat = cats.find((c) => c.id === catId);
      const next = exists ? prev.filter((id) => id !== catId) : [...prev, catId];
      if (exists) {
        showToast(`Удалено из избранного: ${cat?.name || 'котик'}`);
      } else {
        showToast(`Добавлено в избранное: ${cat?.name || 'котик'} ❤️`);
      }
      apiSaveSetting('favorites', next).catch(() => {});
      return next;
    });
  };

  // Open adoption modal for specific cat
  const handleOpenAdoptionForCat = (cat: Cat) => {
    if (cat.status !== 'available') {
      showToast(
        cat.status === 'reserved'
          ? `${cat.name} сейчас на бронировании — подать заявку нельзя`
          : cat.status === 'trial'
            ? `${cat.name} сейчас на испытательном сроке — подать заявку нельзя`
            : `${cat.name} уже дома — приём заявок закрыт`,
      );
      return;
    }
    setSelectedCatForAdoption(cat);
    setIsAdoptionModalOpen(true);
  };

  // Submit application handler: saves to computer database file
  const handleCreateApplication = async (
    newAppData: Omit<AdoptionApplication, 'id' | 'createdAt' | 'status'>
  ) => {
    try {
      const newApp = await apiCreateApplication(newAppData);
      setApplications((prev) => [newApp, ...prev]);
      setAdminApplications((prev) =>
        prev.some((application) => application.id === newApp.id) ? prev : [newApp, ...prev]
      );
      showToast(`Заявка #${newApp.id} на ${newAppData.catName} успешно сохранена в локальную БД!`);
      return newApp;
    } catch (error) {
      showToast('Ошибка при регистрации заявки в базе данных');
      throw error;
    }
  };

  // Update status (Shelter Coordinator admin): saves to computer database file
  const handleUpdateApplicationStatus = async (
    appId: string,
    newStatus: ApplicationStatus,
    adminNotes?: string
  ) => {
    try {
      const updated = await apiUpdateApplication(appId, newStatus, adminNotes);
      setAdminApplications((prev) =>
        prev.map((app) => (app.id === appId ? updated : app))
      );
      showToast(`Статус заявки #${appId} обновлён в локальной БД`);
    } catch {
      showToast('Ошибка при обновлении статуса заявки');
    }
  };

  // Delete application: deletes from computer database file
  const handleDeleteApplication = async (appId: string) => {
    try {
      await apiDeleteApplication(appId);
      setAdminApplications((prev) => prev.filter((app) => app.id !== appId));
      showToast('Заявка удалена из локальной базы данных');
    } catch {
      showToast('Ошибка удаления заявки');
    }
  };

  // Delete article handler: deletes from computer database file
  const handleDeleteArticle = async (articleId: string) => {
    try {
      await apiDeleteArticle(articleId);
      setArticles((prev) => prev.filter((a) => a.id !== articleId));
      setLikedArticleIds((prev) => prev.filter((id) => id !== articleId));
      if (selectedArticleForDetail?.id === articleId) {
        setSelectedArticleForDetail(null);
      }
      showToast('Публикация удалена из новостей');
    } catch {
      showToast('Ошибка при удалении публикации');
    }
  };

  // Create or edit an article in PostgreSQL
  const handleSaveArticle = async (
    articleData: Omit<ShelterArticle, 'id' | 'publishedAt' | 'likesCount'>
  ) => {
    try {
      if (editingArticle) {
        const updatedArticle = await apiUpdateArticle(editingArticle.id, articleData);
        setArticles((prev) => prev.map((article) => article.id === updatedArticle.id ? updatedArticle : article));
        if (selectedArticleForDetail?.id === updatedArticle.id) setSelectedArticleForDetail(updatedArticle);
        showToast(`Материал «${updatedArticle.title}» обновлён`);
      } else {
        const newArticle = await apiPublishArticle(articleData);
        setArticles((prev) => [newArticle, ...prev]);
        setNewlyAddedArticleId(newArticle.id);
        showToast(`Материал «${newArticle.title}» опубликован`);
      }
      setEditingArticle(null);
    } catch {
      showToast(editingArticle ? 'Ошибка при сохранении изменений' : 'Ошибка при публикации материала');
      throw new Error('Article save failed');
    }
  };

  // Add / Edit Cat handler: saves to computer database file
  const handleSaveCat = async (catData: Partial<Cat> & { id?: string }) => {
    try {
      const isNewCat = !catData.id;
      const savedCat = await apiSaveCat(catData);
      setCats((prev) => {
        const exists = prev.some((c) => c.id === savedCat.id);
        if (exists) {
          return prev.map((c) => (c.id === savedCat.id ? savedCat : c));
        }
        return [savedCat, ...prev];
      });

      if (selectedCatForDetail && selectedCatForDetail.id === savedCat.id) {
        setSelectedCatForDetail(savedCat);
      }

      if (isNewCat) {
        setNewlyAddedCatId(savedCat.id);
      }

      showToast(`Анкета котика «${savedCat.name}» сохранена в локальную базу данных!`);
    } catch (error) {
      throw error;
    }
  };

  // Delete Cat handler: deletes from computer database file
  const handleDeleteCat = async (catId: string) => {
    try {
      await apiDeleteCat(catId);
      setCats((prev) => prev.filter((c) => c.id !== catId));
      setFavoriteIds((prev) => {
        const next = prev.filter((id) => id !== catId);
        apiSaveSetting('favorites', next).catch(() => {});
        return next;
      });
      if (selectedCatForDetail?.id === catId) {
        setSelectedCatForDetail(null);
      }
      showToast('Анкета котика удалена из каталога');
    } catch {
      showToast('Ошибка удаления анкеты котика');
    }
  };

  // Export applications (ankety zayavok) to JSON file
  const handleExportApplications = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(adminApplications, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `ankety_zayavok_fond_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast(`Все анкеты заявок (${adminApplications.length}) успешно сохранены в файл!`);
    } catch {
      showToast('Не удалось экспортировать анкеты заявок');
    }
  };

  // Import applications from JSON file
  const handleImportApplications = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        let appsToImport: any[] = [];
        if (Array.isArray(parsed)) {
          appsToImport = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.applications)) {
            appsToImport = parsed.applications;
          } else if (parsed.data && Array.isArray(parsed.data.applications)) {
            appsToImport = parsed.data.applications;
          } else if (parsed.applicantName) {
            appsToImport = [parsed];
          }
        }

        if (appsToImport.length > 0) {
          for (const app of appsToImport) {
            await apiCreateApplication(app);
          }
          const updated = await apiGetAdminApplications();
          setAdminApplications(updated);
          showToast(`Успешно загружено и сохранено анкет-заявок: ${appsToImport.length}`);
        } else {
          showToast('В файле не обнаружены анкеты заявок на усыновление');
        }
      } catch {
        showToast('Ошибка при чтении файла заявок');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Export full computer database (Cats, Applications, Articles, Settings)
  const handleExportAllDatabase = async () => {
    try {
      await apiDownloadDatabaseBackup();
      showToast('Полный архив локальной базы данных успешно выгружен!');
    } catch {
      showToast('Ошибка при выгрузке базы данных');
    }
  };

  // Restore the full PostgreSQL database from a pg_dump custom-format archive.
  const handleImportAllDatabase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!window.confirm('Восстановление заменит текущую базу данных содержимым резервной копии. Продолжить?')) {
      event.target.value = '';
      return;
    }
    try {
      const res = await apiImportDatabaseBackup(file);
      if (!res.success) {
        showToast(res.error || 'Ошибка восстановления базы данных');
        return;
      }
      const [serverCats, serverApps, serverArts] = await Promise.all([
        apiGetCats(),
        apiGetAdminApplications(),
        apiGetArticles(),
      ]);
      setCats(serverCats);
      setAdminApplications(serverApps);
      setArticles(serverArts);
      showToast('База данных успешно восстановлена из резервной копии PostgreSQL!');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Ошибка восстановления базы данных');
    } finally {
      event.target.value = '';
    }
  };

  // Toggle Article Like (saved to computer database)
  const handleToggleArticleLike = async (articleId: string) => {
    setLikedArticleIds((prev) => {
      const exists = prev.includes(articleId);
      const next = exists ? prev.filter((id) => id !== articleId) : [...prev, articleId];
      if (!exists) {
        showToast('Спасибо за поддержку публикации! ❤️');
      }
      apiSaveSetting('likedArticleIds', next).catch(() => {});
      return next;
    });

    try {
      const newCount = await apiLikeArticle(articleId);
      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, likesCount: newCount } : a))
      );
    } catch {}
  };

  // Filtered cats logic: search, gender, ageCategory, size, temperament, compatibility, status
  const filteredCats = useMemo(() => {
    return cats.filter((cat) => {
      // Search filter
      if (filters.search.trim()) {
        const query = filters.search.trim().toLocaleLowerCase('ru');
        const matchesName = cat.name.toLocaleLowerCase('ru').includes(query);
        const matchesBreed = cat.breed.toLocaleLowerCase('ru').includes(query);
        const matchesColor = cat.color.toLocaleLowerCase('ru').includes(query);
        const matchesTrait = cat.character.some((t) => t.toLocaleLowerCase('ru').includes(query));
        const matchesStory = cat.story.toLocaleLowerCase('ru').includes(query);
        if (!matchesName && !matchesBreed && !matchesColor && !matchesTrait && !matchesStory) {
          return false;
        }
      }

      // Gender filter
      if (filters.gender !== 'all' && cat.gender !== filters.gender) {
        return false;
      }

      // Age category filter
      if (filters.ageCategory !== 'all' && cat.ageCategory !== filters.ageCategory) {
        return false;
      }

      // Size filter (small / medium / large)
      if (filters.size !== 'all' && cat.size !== filters.size) {
        return false;
      }

      // Temperament filter (cuddly / playful / calm / independent / curious)
      if (filters.temperament !== 'all' && cat.temperament !== filters.temperament) {
        return false;
      }

      // Status filter
      if (filters.status !== 'all' && cat.status !== filters.status) {
        return false;
      }

      // Compatibility filters
      if (filters.goodWithChildren && !cat.goodWith.children) return false;
      if (filters.goodWithCats && !cat.goodWith.otherCats) return false;
      if (filters.goodWithDogs && !cat.goodWith.dogs) return false;

      return true;
    });
  }, [cats, filters]);

  const myApplications = applications;

  const sortedArticles = useMemo(() => sortArticlesNewestFirst(articles), [articles]);
  const visibleArticles = useMemo(() => selectedArticleTag
    ? sortedArticles.filter((article) => (article.tags || []).some((tag) => articleTagPath(tag) === articleTagPath(selectedArticleTag)))
    : sortedArticles,
  [selectedArticleTag, sortedArticles]);

  const adoptableCats = useMemo(() => cats.filter((cat) => cat.status === 'available'), [cats]);

  // Derived favorite cats
  const favoriteCats = useMemo(() => {
    return cats.filter((c) => favoriteIds.includes(c.id));
  }, [cats, favoriteIds]);

  const handleSaveShelterStats = async (stats: ShelterStats) => {
    const savedStats = await apiUpdateShelterStats(stats);
    setShelterStats(savedStats);
    showToast('Счётчики фонда обновлены');
  };

  const handleSaveSiteContacts = async (contacts: SiteContacts) => {
    const savedContacts = await apiUpdateSiteContacts(contacts);
    setSiteContacts(savedContacts);
    showToast('Контакты сайта обновлены');
  };

  const scrollToCats = () => {
    const el = document.getElementById('cats');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToRules = () => {
    const el = document.getElementById('rules');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50/40 text-stone-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-stone-700 flex items-center gap-2.5 text-xs sm:text-sm font-semibold animate-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}


      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Прокрутить страницу в начало"
        title="Наверх"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-lg shadow-amber-900/20 flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
      >
        <ArrowUp className="w-6 h-6" aria-hidden="true" />
      </button>
      {/* Main Navigation Header */}
      <Navbar
        favoritesCount={favoriteCats.length}
        myApplicationsCount={myApplications.length}
        onOpenFavorites={() => setIsFavoritesModalOpen(true)}
        onOpenMyApplications={() => setIsMyApplicationsModalOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        onOpenAdminDashboard={() => setIsAdminModalOpen(true)}
      />

      {/* Hero Welcome Banner */}
      <HeroSection
        onExploreClick={scrollToCats}
        onHowToAdoptClick={scrollToRules}
        heroCat={dailyHeroCat}
        onHeroCatClick={openCatDetail}
        isLoading={!catsLoaded}
        shelterStats={shelterStats}
      />

      {/* Main Cats Catalog Section */}
      <main className="py-12 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
        {/* Section Heading */}
        <div id="cats" className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Анкеты наших подопечных</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Найдите котика по душе
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Фильтруйте по возрасту, полу, размеру и темпераменту, чтобы найти идеального компаньона.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={() => {
                setSelectedCatForAdoption(adoptableCats[0] || null);
                setIsAdoptionModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              Заполнить онлайн-анкету
            </button>
          </div>
        </div>

        {/* Filter Controls Bar (age, gender, size, temperament) */}
        <CatFilter
          filters={filters}
          onFilterChange={setFilters}
          onResetFilters={() => setFilters(defaultFilters)}
          totalFiltered={filteredCats.length}
          totalCount={cats.length}
        />

        {/* Cats Grid or Empty State */}
        {filteredCats.length === 0 ? (
          <div id="cats-results" className="scroll-mt-4 text-center py-16 px-4 bg-white rounded-3xl border border-stone-200">
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="font-heading font-extrabold text-xl text-stone-900 mb-1">
              По вашим критериям котиков не найдено
            </h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto mb-5">
              Попробуйте выбрать другой размер, возраст или темперамент, либо сбросить фильтры.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setFilters(defaultFilters)}
                className="px-6 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors cursor-pointer shadow-xs"
              >
                Сбросить фильтры и показать всех ({cats.length})
              </button>
            </div>
          </div>
        ) : (
          <div id="cats-results" className="scroll-mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredCats.map((cat) => (
              <CatCard
                key={cat.id}
                cat={cat}
                isFavorite={favoriteIds.includes(cat.id)}
                onToggleFavorite={handleToggleFavorite}
                onViewDetails={openCatDetail}
                onApplyForAdoption={(c) => handleOpenAdoptionForCat(c)}
                detailHref={catSeoPath(cat, cats)}
                searchQuery={filters.search}
              />
            ))}
          </div>
        )}
      </main>

      {/* News, Stories & Events Section */}
      <NewsSection
        articles={visibleArticles}
        likedArticleIds={likedArticleIds}
        onToggleLike={handleToggleArticleLike}
        onReadArticle={openArticleDetail}
        allCats={cats}
        getArticleHref={(article) => articleSeoPath(article, articles)}
        activeTag={selectedArticleTag}
        getTagHref={articleTagPath}
        onSelectTag={openArticleTag}
        onClearTag={clearArticleTag}
      />

      {/* Rules & Process Section */}
      <AdoptionRulesSection
        onStartAdoptionClick={() => {
          setSelectedCatForAdoption(adoptableCats[0] || null);
          setIsAdoptionModalOpen(true);
        }}
      />

      {/* About Shelter Story & Care Section */}
      <ShelterAboutSection contacts={siteContacts} />

      {/* Footer */}
      <Footer contacts={siteContacts} shelterStats={shelterStats} onOpenAdminDashboard={() => setIsAdminModalOpen(true)} />

      {/* --- MODALS --- */}

      <Suspense fallback={null}>
      {/* Cat Details Full Profile Modal (with Photos & Video Gallery) */}
      {selectedCatForDetail && <CatDetailModal
        cat={selectedCatForDetail}
        isFavorite={selectedCatForDetail ? favoriteIds.includes(selectedCatForDetail.id) : false}
        onClose={closeCatDetail}
        onToggleFavorite={handleToggleFavorite}
        onApplyForAdoption={(cat) => handleOpenAdoptionForCat(cat)}
        shareUrl={'https://kind4cat.ru' + catSeoPath(selectedCatForDetail, cats)}
      />}

      {/* Add or Edit Real Cat Modal */}
      {isAddEditModalOpen && <AddEditCatModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setEditingCat(null);
        }}
        onSaveCat={handleSaveCat}
        onDeleteCat={handleDeleteCat}
        initialCat={editingCat}
      />}

      {/* Article Detail Modal (Read full news, story, or event) */}
      {selectedArticleForDetail && <ArticleDetailModal
        article={selectedArticleForDetail}
        isOpen={!!selectedArticleForDetail}
        onClose={closeArticleDetail}
        onToggleLike={handleToggleArticleLike}
        isLiked={selectedArticleForDetail ? likedArticleIds.includes(selectedArticleForDetail.id) : false}
        relatedCat={
          selectedArticleForDetail?.relatedCatId
            ? cats.find((c) => c.id === selectedArticleForDetail.relatedCatId)
            : null
        }
        onViewRelatedCat={openCatDetail}
        getTagHref={articleTagPath}
        onSelectTag={openArticleTag}
      />}

      {/* Publish Article Modal (Publish rescue story, success, or event) */}
      {isPublishArticleModalOpen && <PublishArticleModal
        isOpen={isPublishArticleModalOpen}
        initialArticle={editingArticle}
        onClose={() => {
          setIsPublishArticleModalOpen(false);
          setEditingArticle(null);
        }}
        onSave={handleSaveArticle}
      />}

      {/* Adoption Application Submission Modal */}
      {isAdoptionModalOpen && <AdoptionModal
        cat={selectedCatForAdoption}
        allCats={adoptableCats}
        isOpen={isAdoptionModalOpen}
        onClose={() => setIsAdoptionModalOpen(false)}
        onSubmitApplication={handleCreateApplication}
        onViewMyApplications={() => setIsMyApplicationsModalOpen(true)}
      />}

      {/* Applicant's Application Status Tracker Modal */}
      {isMyApplicationsModalOpen && <MyApplicationsModal
        isOpen={isMyApplicationsModalOpen}
        onClose={() => setIsMyApplicationsModalOpen(false)}
        applications={myApplications}
        contacts={siteContacts}
        onOpenAdoptionModal={() => {
          setSelectedCatForAdoption(adoptableCats[0] || null);
          setIsAdoptionModalOpen(true);
        }}
      />}

      {/* Shelter Coordinator Protected Admin Management Dashboard Modal */}
      {isAdminModalOpen && <AdminDashboard
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        cats={cats}
        newlyAddedCatId={newlyAddedCatId}
        onNewCatPositioned={() => setNewlyAddedCatId(null)}
        catRatings={catRatings}
        visitAnalytics={visitAnalytics}
        shelterStats={shelterStats}
        onSaveShelterStats={handleSaveShelterStats}
        siteContacts={siteContacts}
        onSaveSiteContacts={handleSaveSiteContacts}
        onAddNewCat={() => {
          setEditingCat(null);
          setIsAddEditModalOpen(true);
        }}
        onEditCat={(cat) => {
          setEditingCat(cat);
          setIsAddEditModalOpen(true);
        }}
        onDeleteCat={handleDeleteCat}
        onExportAllDatabase={handleExportAllDatabase}
        onImportAllDatabase={handleImportAllDatabase}
        articles={sortedArticles}
        newlyAddedArticleId={newlyAddedArticleId}
        onNewArticlePositioned={() => setNewlyAddedArticleId(null)}
        onOpenPublishArticleModal={() => {
          setEditingArticle(null);
          setIsPublishArticleModalOpen(true);
        }}
        onEditArticle={(article) => {
          setEditingArticle(article);
          setIsPublishArticleModalOpen(true);
        }}
        onDeleteArticle={handleDeleteArticle}
        applications={adminApplications}
        onUpdateApplicationStatus={handleUpdateApplicationStatus}
        onDeleteApplication={handleDeleteApplication}
        onExportApplications={handleExportApplications}
        onImportApplications={handleImportApplications}
        onAuthenticated={async () => {
          const [loadedApplications, loadedRatings, loadedAnalytics] = await Promise.all([
            apiGetAdminApplications(),
            apiGetCatRatings(),
            apiGetVisitAnalytics(30),
          ]);
          setAdminApplications(loadedApplications);
          setCatRatings(loadedRatings);
          setVisitAnalytics(loadedAnalytics);
        }}
      />}

      {/* Favorites Modal */}
      {isFavoritesModalOpen && <FavoritesModal
        isOpen={isFavoritesModalOpen}
        onClose={() => setIsFavoritesModalOpen(false)}
        favoriteCats={favoriteCats}
        onRemoveFavorite={handleToggleFavorite}
        onSelectCat={openCatDetail}
        onApplyForAdoption={(c) => handleOpenAdoptionForCat(c)}
      />}

      {/* Help & Support Shelter Modal */}
      {isHelpModalOpen && <HelpShelterModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        heroCat={dailyHeroCat}
        contacts={siteContacts}
        donationSettings={donationSettings}
      />}
      </Suspense>
    </div>
  );
}






































