import React, { useState } from 'react';
import {
  Lock,
  LogOut,
  Cat as CatIcon,
  Plus,
  PenTool,
  ClipboardList,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  Home,
  MapPin,
  MessageSquare,
  AlertCircle,
  Download,
  Upload,
  Trash2,
  Edit3,
  X,
  Shield,
  KeyRound,
  FileText,
  Calendar,
  Sparkles,
  ChevronRight,
  Filter,
  Key,
  Database,
  HardDrive,
  RefreshCw,
  Heart,
  BarChart3,
  Users,
  Eye,
  Folder,
  FolderOpen,
  ArrowLeft,
  Menu,
  ChevronDown,
} from 'lucide-react';
import { Cat, AdoptionApplication, ApplicationStatus, ShelterArticle, ShelterStats, SiteContacts } from '../types';
import realCatPhoto from '../assets/defaultCat';
import {
  apiVerifyAdminPassword,
  apiGetAdminSession,
  apiLogoutAdmin,
  apiChangeAdminPassword,
  apiGetDatabaseStats,
  apiGetDatabaseBackupSchedule,
  apiUpdateDatabaseBackupSchedule,
  apiBrowseServerBackupDirectories,
  apiCreateServerBackupDirectory,
  ServerDatabaseStats,
  DatabaseBackupScheduleStatus,
  ServerDirectoryListing,
  ADMIN_SESSION_EXPIRED_EVENT,
  ADMIN_SESSION_AUTHENTICATED_EVENT,
  CatRating,
  VisitAnalytics,
} from '../utils/api';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  // Cats data & actions
  cats: Cat[];
  newlyAddedCatId?: string | null;
  onNewCatPositioned?: () => void;
  catRatings: CatRating[];
  visitAnalytics: VisitAnalytics | null;
  shelterStats: ShelterStats;
  onSaveShelterStats: (stats: ShelterStats) => Promise<void>;
  siteContacts: SiteContacts;
  onSaveSiteContacts: (contacts: SiteContacts) => Promise<void>;
  onAddNewCat: () => void;
  onEditCat: (cat: Cat) => void;
  onDeleteCat: (catId: string) => void;
  // News / Stories data & actions
  articles: ShelterArticle[];
  newlyAddedArticleId?: string | null;
  onNewArticlePositioned?: () => void;
  onOpenPublishArticleModal: () => void;
  onEditArticle?: (article: ShelterArticle) => void;
  onDeleteArticle?: (articleId: string) => void;
  // Applications data & actions
  applications: AdoptionApplication[];
  onUpdateApplicationStatus: (id: string, newStatus: ApplicationStatus, notes?: string) => void;
  onDeleteApplication: (id: string) => void;
  onExportApplications?: () => void;
  onImportApplications?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  // Database backup & actions
  onExportAllDatabase?: () => Promise<void> | void;
  onImportAllDatabase?: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void> | void;
  onAuthenticated: () => Promise<void> | void;
}

type AdminTabId = 'applications' | 'cats' | 'articles' | 'stats' | 'contacts' | 'analytics' | 'database';

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  new: {
    label: 'Новая заявка',
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
  },
  reviewing: {
    label: 'На рассмотрении',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  meeting_scheduled: {
    label: 'Встреча в передержке',
    bg: 'bg-purple-50 border-purple-200',
    text: 'text-purple-800',
    dot: 'bg-purple-500',
  },
  approved: {
    label: 'Одобрено (едет домой)',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'Отклонена',
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-800',
    dot: 'bg-rose-500',
  },
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose,
  cats,
  newlyAddedCatId,
  onNewCatPositioned,
  catRatings,
  visitAnalytics,
  shelterStats,
  onSaveShelterStats,
  siteContacts,
  onSaveSiteContacts,
  onAddNewCat,
  onEditCat,
  onDeleteCat,
  articles,
  newlyAddedArticleId,
  onNewArticlePositioned,
  onOpenPublishArticleModal,
  onEditArticle,
  onDeleteArticle,
  applications,
  onUpdateApplicationStatus,
  onDeleteApplication,
  onExportApplications,
  onImportApplications,
  onExportAllDatabase,
  onImportAllDatabase,
  onAuthenticated,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);

  const [passwordInput, setPasswordInput] = useState('');
  const passwordInputRef = React.useRef<HTMLInputElement>(null);
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTabId>('applications');
  const [isMobileTabMenuOpen, setIsMobileTabMenuOpen] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [serverStats, setServerStats] = useState<ServerDatabaseStats | null>(null);
  const [backupSchedule, setBackupSchedule] = useState<DatabaseBackupScheduleStatus | null>(null);
  const [backupScheduleTime, setBackupScheduleTime] = useState('03:00');
  const [backupRetentionCount, setBackupRetentionCount] = useState('7');
  const [backupDirectory, setBackupDirectory] = useState('');
  const [isSavingBackupSchedule, setIsSavingBackupSchedule] = useState(false);
  const [backupScheduleMessage, setBackupScheduleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDirectoryBrowserOpen, setIsDirectoryBrowserOpen] = useState(false);
  const [directoryListing, setDirectoryListing] = useState<ServerDirectoryListing | null>(null);
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(false);
  const [directoryBrowserError, setDirectoryBrowserError] = useState('');
  const [isNewDirectoryFormOpen, setIsNewDirectoryFormOpen] = useState(false);
  const [newDirectoryName, setNewDirectoryName] = useState('');
  const [newDirectoryError, setNewDirectoryError] = useState('');
  const [isCreatingDirectory, setIsCreatingDirectory] = useState(false);

  React.useEffect(() => {
    const handleSessionExpired = () => setIsAuthenticated(false);
    const handleSessionAuthenticated = () => setIsAuthenticated(true);
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener(ADMIN_SESSION_AUTHENTICATED_EVENT, handleSessionAuthenticated);
    return () => {
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired);
      window.removeEventListener(ADMIN_SESSION_AUTHENTICATED_EVENT, handleSessionAuthenticated);
    };
  }, []);

  React.useEffect(() => {
    if (!isOpen || !isAuthenticated) setIsMobileTabMenuOpen(false);
  }, [isOpen, isAuthenticated]);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsAuthenticated(false);
    setIsCheckingSession(true);
    apiGetAdminSession()
      .then(async (authenticated) => {
        if (cancelled) return;
        setIsAuthenticated(authenticated);
        if (authenticated) await onAuthenticated();
      })
      .finally(() => {
        if (!cancelled) setIsCheckingSession(false);
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen && isAuthenticated && activeTab === 'database') {
      apiGetDatabaseStats().then(setServerStats).catch(() => {});
      apiGetDatabaseBackupSchedule()
        .then((status) => {
          setBackupSchedule(status);
          setBackupScheduleTime(status.time);
          setBackupRetentionCount(String(status.retentionCount));
          setBackupDirectory(status.directory);
        })
        .catch(() => {
          setBackupScheduleMessage({ type: 'error', text: 'Не удалось загрузить расписание резервного копирования.' });
        });
    }
  }, [isOpen, isAuthenticated, activeTab]);

  React.useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    const refreshApplications = async () => {
      const authenticated = await apiGetAdminSession();
      if (!authenticated) {
        setIsAuthenticated(false);
        return;
      }
      await Promise.resolve(onAuthenticated()).catch(() => {});
    };
    const intervalId = window.setInterval(refreshApplications, 5000);
    return () => window.clearInterval(intervalId);
  }, [isOpen, isAuthenticated]);

  // Change password modal state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordChangeMessage, setPasswordChangeMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Applications sub-state
  const [appSearchTerm, setAppSearchTerm] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [curatorNote, setCuratorNote] = useState('');

  // Cats sub-state in admin
  const [catSearchTerm, setCatSearchTerm] = useState('');

  // Public counters shown on the home page
  const [adoptedCountInput, setAdoptedCountInput] = useState(String(shelterStats.adoptedCount));
  const [currentCountInput, setCurrentCountInput] = useState(String(shelterStats.currentCount));
  const [statsSaveMessage, setStatsSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingStats, setIsSavingStats] = useState(false);

  React.useEffect(() => {
    setAdoptedCountInput(String(shelterStats.adoptedCount));
    setCurrentCountInput(String(shelterStats.currentCount));
  }, [shelterStats]);

  const [contactForm, setContactForm] = useState<SiteContacts>(siteContacts);
  const [contactsSaveMessage, setContactsSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingContacts, setIsSavingContacts] = useState(false);

  React.useEffect(() => {
    setContactForm(siteContacts);
  }, [siteContacts]);

  const handleContactsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const contacts = {
      address: contactForm.address.trim(),
      visitingHours: contactForm.visitingHours.trim(),
      phone: contactForm.phone.trim(),
      telegram: contactForm.telegram.trim(),
      telegramUrl: contactForm.telegramUrl.trim(),
      maxUrl: contactForm.maxUrl.trim(),
      vkUrl: contactForm.vkUrl.trim(),
      youtubeUrl: contactForm.youtubeUrl.trim(),
    };
    if (!contacts.address || !contacts.visitingHours || !contacts.telegram || !contacts.telegramUrl) {
      setContactsSaveMessage({ type: 'error', text: 'Заполните все поля контактов.' });
      return;
    }

    setIsSavingContacts(true);
    setContactsSaveMessage(null);
    try {
      await onSaveSiteContacts(contacts);
      setContactsSaveMessage({ type: 'success', text: 'Контакты сохранены и обновлены на сайте.' });
    } catch {
      setContactsSaveMessage({ type: 'error', text: 'Не удалось сохранить контакты. Проверьте ссылки на группы.' });
    } finally {
      setIsSavingContacts(false);
    }
  };

  const handleStatsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const adoptedCount = Number(adoptedCountInput);
    const currentCount = Number(currentCountInput);
    if (
      !adoptedCountInput.trim() ||
      !currentCountInput.trim() ||
      !Number.isInteger(adoptedCount) ||
      !Number.isInteger(currentCount) ||
      adoptedCount < 0 ||
      currentCount < 0
    ) {
      setStatsSaveMessage({ type: 'error', text: 'Укажите целые неотрицательные числа.' });
      return;
    }

    setIsSavingStats(true);
    setStatsSaveMessage(null);
    try {
      await onSaveShelterStats({ adoptedCount, currentCount });
      setStatsSaveMessage({ type: 'success', text: 'Счётчики сохранены и обновлены на главной странице.' });
    } catch {
      setStatsSaveMessage({ type: 'error', text: 'Не удалось сохранить счётчики.' });
    } finally {
      setIsSavingStats(false);
    }
  };

  const handleCreateDatabaseBackup = async () => {
    if (!onExportAllDatabase || isCreatingBackup || isRestoringBackup) return;

    setIsCreatingBackup(true);
    try {
      await onExportAllDatabase();
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreDatabaseBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onImportAllDatabase || isCreatingBackup || isRestoringBackup) {
      event.target.value = '';
      return;
    }

    setIsRestoringBackup(true);
    try {
      await onImportAllDatabase(event);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleBackupScheduleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const retentionCount = Number(backupRetentionCount);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(backupScheduleTime)) {
      setBackupScheduleMessage({ type: 'error', text: 'Укажите корректное время запуска.' });
      return;
    }
    if (!Number.isInteger(retentionCount) || retentionCount < 1 || retentionCount > 90) {
      setBackupScheduleMessage({ type: 'error', text: 'Количество копий должно быть от 1 до 90.' });
      return;
    }

    setIsSavingBackupSchedule(true);
    setBackupScheduleMessage(null);
    try {
      if (!backupDirectory.trim()) {
        setBackupScheduleMessage({ type: 'error', text: 'Выберите папку для автоматических backup.' });
        return;
      }
      const status = await apiUpdateDatabaseBackupSchedule(backupScheduleTime, retentionCount, backupDirectory.trim());
      setBackupSchedule(status);
      setBackupScheduleTime(status.time);
      setBackupRetentionCount(String(status.retentionCount));
      setBackupDirectory(status.directory);
      setBackupScheduleMessage({ type: 'success', text: 'Расписание автоматического backup сохранено.' });
    } catch (error) {
      setBackupScheduleMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Не удалось сохранить расписание.',
      });
    } finally {
      setIsSavingBackupSchedule(false);
    }
  };

  const loadServerDirectory = async (path?: string) => {
    setIsDirectoryLoading(true);
    setDirectoryBrowserError('');
    try {
      setDirectoryListing(await apiBrowseServerBackupDirectories(path));
      setIsNewDirectoryFormOpen(false);
      setNewDirectoryName('');
      setNewDirectoryError('');
    } catch (error) {
      setDirectoryBrowserError(error instanceof Error ? error.message : 'Не удалось открыть папку на сервере.');
    } finally {
      setIsDirectoryLoading(false);
    }
  };

  const handleOpenDirectoryBrowser = async () => {
    setIsDirectoryBrowserOpen(true);
    try {
      await loadServerDirectory(backupDirectory || undefined);
    } catch {
      // Errors are displayed inside the directory browser.
    }
  };

  const handleSelectBackupDirectory = () => {
    if (!directoryListing?.currentPath) return;
    setBackupDirectory(directoryListing.currentPath);
    setBackupScheduleMessage(null);
    setIsDirectoryBrowserOpen(false);
  };

  const handleCreateServerDirectory = async (event: React.FormEvent) => {
    event.preventDefault();
    const parentPath = directoryListing?.currentPath;
    const name = newDirectoryName.trim();
    if (!parentPath || !name) {
      setNewDirectoryError('Введите имя новой папки.');
      return;
    }

    setIsCreatingDirectory(true);
    setNewDirectoryError('');
    try {
      const listing = await apiCreateServerBackupDirectory(parentPath, name);
      setDirectoryListing(listing);
      setIsNewDirectoryFormOpen(false);
      setNewDirectoryName('');
    } catch (error) {
      setNewDirectoryError(error instanceof Error ? error.message : 'Не удалось создать папку.');
    } finally {
      setIsCreatingDirectory(false);
    }
  };

  const formatBackupDate = (value: string | null | undefined) => {
    if (!value) return 'ещё не выполнялся';
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  };

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const authenticated = await apiVerifyAdminPassword(passwordInput);
    if (!authenticated) {
      setLoginError('Неверный пароль или превышено число попыток входа.');
      return;
    }
    setIsAuthenticated(true);
    setLoginError('');
    setPasswordInput('');
    await onAuthenticated();
  };

  const handleLogout = async () => {
    await apiLogoutAdmin().catch(() => {});
    setIsAuthenticated(false);
    setPasswordInput('');
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasswordInput.length < 8) {
      setPasswordChangeMessage({ type: 'error', text: 'Новый пароль должен содержать минимум 8 символов' });
      return;
    }
    if (newPasswordInput !== newPasswordConfirm) {
      setPasswordChangeMessage({ type: 'error', text: 'Новые пароли не совпадают' });
      return;
    }
    const result = await apiChangeAdminPassword(oldPasswordInput, newPasswordInput);
    if (!result.success) {
      setPasswordChangeMessage({ type: 'error', text: result.error || 'Не удалось сменить пароль' });
      return;
    }
    setPasswordChangeMessage({ type: 'success', text: 'Пароль изменён. Войдите с новым паролем.' });
    setIsAuthenticated(false);
    setTimeout(() => {
      setIsChangePasswordOpen(false);
      setOldPasswordInput('');
      setNewPasswordInput('');
      setNewPasswordConfirm('');
      setPasswordChangeMessage(null);
    }, 1200);
  };
  // Applications filtering
  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.applicantName.toLowerCase().includes(appSearchTerm.toLowerCase()) ||
      app.catName.toLowerCase().includes(appSearchTerm.toLowerCase()) ||
      app.phone.includes(appSearchTerm) ||
      app.id.toLowerCase().includes(appSearchTerm.toLowerCase());

    const matchesStatus = appStatusFilter === 'all' || app.status === appStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Cats filtering and private curator rating
  const ratingByCatId = new Map(catRatings.map((rating) => [rating.catId, rating]));
  const filteredCats = cats.filter((cat) =>
    cat.name.toLowerCase().includes(catSearchTerm.toLowerCase()) ||
    cat.breed.toLowerCase().includes(catSearchTerm.toLowerCase()) ||
    cat.color.toLowerCase().includes(catSearchTerm.toLowerCase())
  ).sort((left, right) => {
    const likesDifference = (ratingByCatId.get(right.id)?.likesCount || 0) - (ratingByCatId.get(left.id)?.likesCount || 0);
    return likesDifference || left.name.localeCompare(right.name, 'ru');
  });

  React.useEffect(() => {
    if (!isOpen || activeTab !== 'cats' || !newlyAddedCatId) return;

    if (catSearchTerm) {
      setCatSearchTerm('');
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const newCatRow = document.getElementById(`admin-cat-row-${newlyAddedCatId}`);
      if (!newCatRow) return;
      newCatRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onNewCatPositioned?.();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, catSearchTerm, cats, isOpen, newlyAddedCatId, onNewCatPositioned]);

  React.useEffect(() => {
    if (!isOpen || activeTab !== 'articles' || !newlyAddedArticleId) return;

    const frameId = window.requestAnimationFrame(() => {
      const newArticleRow = document.getElementById(`admin-article-row-${newlyAddedArticleId}`);
      if (!newArticleRow) return;
      newArticleRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onNewArticlePositioned?.();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, articles, isOpen, newlyAddedArticleId, onNewArticlePositioned]);

  const adminTabs: ReadonlyArray<{
    id: AdminTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'applications', label: 'Заявки', icon: ClipboardList, count: applications.length },
    { id: 'cats', label: 'Котики', icon: CatIcon, count: cats.length },
    { id: 'articles', label: 'Новости', icon: PenTool, count: articles.length },
    { id: 'contacts', label: 'Контакты', icon: MapPin },
    { id: 'stats', label: 'Счётчики', icon: Sparkles },
    { id: 'analytics', label: 'Посещения', icon: BarChart3 },
    { id: 'database', label: 'База данных', icon: Database },
  ];
  const activeAdminTab = adminTabs.find((tab) => tab.id === activeTab) || adminTabs[0];
  const ActiveAdminTabIcon = activeAdminTab.icon;

  const selectAdminTab = (tabId: AdminTabId) => {
    setActiveTab(tabId);
    setIsMobileTabMenuOpen(false);
  };

  const maxDailyVisits = Math.max(1, ...(visitAnalytics?.daily.map((day) => day.visits) || [1]));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-stone-950/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={() => {
        if (isAuthenticated) return;
        if (passwordInput.length === 0) {
          onClose();
          return;
        }
        passwordInputRef.current?.focus({ preventScroll: true });
      }}
    >
      <div
        id="admin-dashboard-container"
        className="relative w-full h-full sm:h-auto max-w-5xl bg-white rounded-none sm:rounded-3xl shadow-2xl overflow-hidden sm:my-6 max-h-none sm:max-h-[92vh] flex flex-col border-0 sm:border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-30 flex items-center justify-between gap-2 px-3 sm:px-8 py-3 sm:py-5 border-b border-stone-800 bg-stone-900 text-white shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl sm:rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-heading font-extrabold text-sm sm:text-lg tracking-tight truncate">
                  <span className="sm:hidden">Панель куратора</span>
                  <span className="hidden sm:inline">Панель куратора и администрации</span>
                </h3>
                {isAuthenticated && (
                  <span className="hidden md:inline px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 whitespace-nowrap">
                    Доступ разрешён
                  </span>
                )}
              </div>
              <p className="hidden sm:block text-xs text-stone-400 truncate">
                Защищённый раздел управления каталогом, публикациями и анкетами усыновителей
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isAuthenticated && (
              <>
                <button
                  onClick={() => {
                    setIsChangePasswordOpen(true);
                    setPasswordChangeMessage(null);
                    setOldPasswordInput('');
                    setNewPasswordInput('');
                    setNewPasswordConfirm('');
                  }}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-700"
                  title="Изменить пароль куратора"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Сменить пароль</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="px-2.5 py-2 sm:px-3 sm:py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 text-rose-100 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-900/70"
                  title="Выйти из режима администратора"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-300" />
                  <span>Выйти</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
              title="Закрыть окно"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Change Password Dialog Modal */}
        {isChangePasswordOpen && (
          <div className="absolute inset-0 z-20 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Key className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-stone-900 text-sm">Смена пароля куратора</h4>
                </div>
                <button
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Текущий пароль
                  </label>
                  <input
                    type="password"
                    value={oldPasswordInput}
                    onChange={(e) => setOldPasswordInput(e.target.value)}
                    placeholder="Введите старый пароль"
                    required
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Новый пароль
                  </label>
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Минимум 8 символов"
                    required
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Подтвердите новый пароль
                  </label>
                  <input
                    type="password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="Повторите новый пароль"
                    required
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {passwordChangeMessage && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 ${
                      passwordChangeMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {passwordChangeMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{passwordChangeMessage.text}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsChangePasswordOpen(false)}
                    className="flex-1 py-2 px-3 rounded-xl border border-stone-200 text-stone-600 text-xs font-semibold hover:bg-stone-50 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Сохранить
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Content Body: Login Screen OR Authenticated Dashboard */}
        {isCheckingSession ? (
          <div className="p-6 sm:p-12 flex-1 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-4" />
            <p className="text-sm font-semibold text-stone-700">Проверяем доступ к кабинету…</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="p-6 sm:p-12 flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mb-5 shadow-inner">
              <KeyRound className="w-8 h-8" />
            </div>

            <h4 className="font-heading font-extrabold text-2xl text-stone-900 mb-2">
              Вход в кабинет куратора
            </h4>
            <p className="text-sm text-stone-600 mb-6">
              Для добавления котиков, публикации новостей фонда и обработки заявок введите пароль доступа сотрудника.
            </p>

            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div className="text-left">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Пароль администратора
                </label>
                <div className="relative">
                  <input
                    ref={passwordInputRef}
                    type="password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (loginError) setLoginError('');
                    }}
                    placeholder="Введите пароль..."
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-stone-900"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                </div>
                {loginError && (
                  <p className="mt-2 text-xs text-rose-600 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{loginError}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Войти в панель управления</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Navigation Tabs Bar */}
            <div className="relative z-20 px-3 sm:px-8 py-2.5 sm:py-3 bg-stone-50 border-b border-stone-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shrink-0">
              <div className="relative lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileTabMenuOpen((open) => !open)}
                  aria-expanded={isMobileTabMenuOpen}
                  aria-controls="admin-mobile-navigation"
                  className="w-full min-h-11 px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-stone-800 font-bold flex items-center gap-2.5 shadow-xs transition-colors hover:border-amber-300 hover:bg-amber-50 cursor-pointer"
                >
                  <ActiveAdminTabIcon className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                  <span className="text-sm">{activeAdminTab.label}</span>
                  {typeof activeAdminTab.count === 'number' && (
                    <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px]">
                      {activeAdminTab.count}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-2 text-xs text-stone-500">
                    <Menu className="w-4.5 h-4.5" />
                    <ChevronDown className={'w-4 h-4 transition-transform ' + (isMobileTabMenuOpen ? 'rotate-180' : '')} />
                  </span>
                </button>

                {isMobileTabMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Закрыть меню разделов"
                      onClick={() => setIsMobileTabMenuOpen(false)}
                      className="fixed inset-0 z-30 bg-stone-950/30 lg:hidden cursor-default"
                    />
                    <nav
                      id="admin-mobile-navigation"
                      aria-label="Разделы панели куратора"
                      className="absolute z-40 top-full left-0 right-0 mt-2 p-2 rounded-2xl border border-stone-200 bg-white shadow-2xl grid grid-cols-1 sm:grid-cols-2 gap-1"
                    >
                      {adminTabs.map(({ id, label, icon: Icon, count }) => {
                        const isActive = activeTab === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => selectAdminTab(id)}
                            aria-current={isActive ? 'page' : undefined}
                            className={'min-h-11 px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors cursor-pointer ' + (
                              isActive
                                ? 'bg-amber-500 text-white'
                                : 'text-stone-700 hover:bg-amber-50 hover:text-amber-800'
                            )}
                          >
                            <Icon className={'w-5 h-5 shrink-0 ' + (isActive ? 'text-white' : 'text-amber-600')} />
                            <span>{label}</span>
                            {typeof count === 'number' && (
                              <span className={'ml-auto px-1.5 py-0.5 rounded-full text-[10px] ' + (isActive ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600')}>
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </nav>
                  </>
                )}
              </div>
              <div className="hidden lg:grid grid-cols-7 gap-2 w-full">
                <button
                  onClick={() => setActiveTab('applications')}
                  title="Заявки на усыновление"
                  className={`min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === 'applications'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Заявки</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-xs ${
                      activeTab === 'applications'
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {applications.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('cats')}
                  title="Каталог котиков"
                  className={`min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === 'cats'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <CatIcon className="w-4 h-4" />
                  <span>Котики</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-xs ${
                      activeTab === 'cats'
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {cats.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('articles')}
                  title="Новости и истории"
                  className={`min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === 'articles'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <PenTool className="w-4 h-4" />
                  <span>Новости</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-xs ${
                      activeTab === 'articles'
                        ? 'bg-amber-600 text-white'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {articles.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('contacts')}
                  className={'min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ' + (
                    activeTab === 'contacts'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  )}
                >
                  <MapPin className="w-4 h-4" />
                  <span>Контакты</span>
                </button>

                <button
                  onClick={() => setActiveTab('stats')}
                  className={'min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ' + (
                    activeTab === 'stats'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Счётчики</span>
                </button>

                <button
                  onClick={() => setActiveTab('analytics')}
                  className={'min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ' + (
                    activeTab === 'analytics'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Посещения</span>
                </button>

                <button
                  onClick={() => setActiveTab('database')}
                  title="База данных"
                  className={`min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === 'database'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  <span>База</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-xs font-semibold ${
                      activeTab === 'database'
                        ? 'bg-amber-600 text-white'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    БД
                  </span>
                </button>
              </div>

              {/* Action buttons inside header corresponding to tab */}
              <div className="hidden">
                {activeTab === 'cats' && (
                  <button
                    onClick={onAddNewCat}
                    className="w-full lg:w-auto justify-center px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
                    <span>Добавить котика</span>
                  </button>
                )}

                {activeTab === 'articles' && (
                  <button
                    onClick={onOpenPublishArticleModal}
                    className="w-full lg:w-auto justify-center px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5 text-amber-400" />
                    <span>Опубликовать новость</span>
                  </button>
                )}
              </div>
            </div>

            {/* TAB 1: Applications Management */}
            {activeTab === 'applications' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Search & Status Filters */}
                <div className="p-4 sm:p-5 border-b border-stone-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={appSearchTerm}
                      onChange={(e) => setAppSearchTerm(e.target.value)}
                      placeholder="Поиск по имени, котику, телефону..."
                      className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-stone-800"
                    />
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                    <span className="text-xs text-stone-500 font-medium whitespace-nowrap">Статус:</span>
                    <select
                      value={appStatusFilter}
                      onChange={(e) => setAppStatusFilter(e.target.value as any)}
                      className="py-1.5 px-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="all">Все статусы ({applications.length})</option>
                      <option value="new">Новые</option>
                      <option value="reviewing">На рассмотрении</option>
                      <option value="meeting_scheduled">Встреча в передержке</option>
                      <option value="approved">Одобрено (уехал домой)</option>
                      <option value="rejected">Отклонено</option>
                    </select>

                    {onExportApplications && (
                      <button
                        onClick={onExportApplications}
                        className="py-1.5 px-2.5 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50 text-stone-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
                        title="Экспортировать анкеты-заявки в JSON"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-600" />
                        <span className="hidden sm:inline">Экспорт заявок</span>
                      </button>
                    )}

                    {onImportApplications && (
                      <label
                        htmlFor="admin-import-apps-input"
                        className="py-1.5 px-2.5 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50 text-stone-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
                        title="Импортировать анкеты-заявки из JSON"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-600" />
                        <span>Импорт анкет</span>
                        <input
                          id="admin-import-apps-input"
                          type="file"
                          accept=".json,application/json"
                          onChange={onImportApplications}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Applications List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  {filteredApps.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-40 text-stone-300" />
                      <p className="font-semibold text-sm text-stone-700">Заявок не найдено</p>
                      <p className="text-xs text-stone-500 mt-0.5">Попробуйте изменить параметры поиска или фильтрации</p>
                    </div>
                  ) : (
                    filteredApps.map((app) => {
                      const statusInfo = STATUS_CONFIG[app.status] || STATUS_CONFIG.new;
                      const isEditingThisNote = editingNotesId === app.id;

                      return (
                        <div
                          key={app.id}
                          className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs hover:border-amber-300 transition-colors"
                        >
                          {/* Top Row */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                            <div className="flex items-center gap-3">
                              <img
                                src={app.catPhoto || realCatPhoto}
                                alt={app.catName}
                                className="w-11 h-11 rounded-xl object-cover border border-stone-200 shrink-0"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = realCatPhoto;
                                }}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-stone-900">
                                    {app.applicantName}
                                  </span>
                                  <span className="text-xs text-stone-400 font-mono">
                                    #{app.id}
                                  </span>
                                </div>
                                <p className="text-xs text-stone-600">
                                  Котик: <strong className="text-amber-800">{app.catName}</strong> • Отправлено {app.createdAt}
                                </p>
                              </div>
                            </div>

                            {/* Status Selector */}
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <div
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${statusInfo.bg} ${statusInfo.text}`}
                              >
                                <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
                                <select
                                  value={app.status}
                                  onChange={(e) =>
                                    onUpdateApplicationStatus(app.id, e.target.value as ApplicationStatus)
                                  }
                                  className="bg-transparent font-bold focus:outline-none cursor-pointer"
                                >
                                  <option value="new">Новая заявка</option>
                                  <option value="reviewing">На рассмотрении</option>
                                  <option value="meeting_scheduled">Встреча в передержке</option>
                                  <option value="approved">Одобрено (уехал домой)</option>
                                  <option value="rejected">Отклонена</option>
                                </select>
                              </div>

                              <button
                                onClick={() => {
                                  if (confirm(`Удалить заявку #${app.id}?`)) {
                                    onDeleteApplication(app.id);
                                  }
                                }}
                                className="p-2 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                title="Удалить заявку"
                              >
                                <Trash2 className="w-4 h-4" />

                              </button>
                            </div>
                          </div>

                          {/* Applicant Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-3 text-xs text-stone-600 border-b border-stone-100">
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                              <a
                                href={`tel:${app.phone}`}
                                className="hover:text-amber-600 font-medium"
                              >
                                {app.phone}
                              </a>
                            </div>

                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                              <a
                                href={`mailto:${app.email}`}
                                className="hover:text-amber-600 truncate"
                              >
                                {app.email}
                              </a>
                            </div>

                            <div className="flex items-center gap-2">
                              <Home className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                              <span className="truncate">
                                {app.housingType === 'own_apartment' ? 'Собственная квартира' : 'Аренда'} • {app.city}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 font-medium">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  app.hasWindowScreens ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              <span>
                                {app.hasWindowScreens ? 'Антикошка есть' : 'Нет сеток "антикошка"'}
                              </span>
                            </div>
                          </div>

                          {/* Comment & Notes */}
                          <div className="pt-3 text-xs space-y-2">
                            {app.comment && (
                              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 text-stone-700">
                                <span className="font-bold text-stone-900 block mb-0.5">
                                  Комментарий заявителя:
                                </span>
                                {app.comment}
                              </div>
                            )}

                            {/* Curator Internal Note */}
                            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-amber-950">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider text-amber-900">
                                  <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                                  Внутренняя заметка куратора:
                                </span>
                                {!isEditingThisNote && (
                                  <button
                                    onClick={() => {
                                      setEditingNotesId(app.id);
                                      setCuratorNote(app.adminNotes || '');
                                    }}
                                    className="text-[11px] text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer"
                                  >
                                    {app.adminNotes ? 'Редактировать' : '+ Добавить заметку'}
                                  </button>
                                )}
                              </div>

                              {isEditingThisNote ? (
                                <div className="space-y-2 mt-2">
                                  <textarea
                                    value={curatorNote}
                                    onChange={(e) => setCuratorNote(e.target.value)}
                                    placeholder="Результат созвона, проверка сеток, договорённость по времени..."
                                    rows={2}
                                    className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900"
                                  />
                                  <div className="flex items-center gap-2 justify-end">
                                    <button
                                      onClick={() => setEditingNotesId(null)}
                                      className="px-2.5 py-1 rounded-md bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
                                    >
                                      Отмена
                                    </button>
                                    <button
                                      onClick={() => {
                                        onUpdateApplicationStatus(app.id, app.status, curatorNote);
                                        setEditingNotesId(null);
                                      }}
                                      className="px-3 py-1 rounded-md bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 cursor-pointer"
                                    >
                                      Сохранить
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="italic text-stone-700 text-xs">
                                  {app.adminNotes || 'Заметок пока нет. Нажмите «Добавить заметку» для сохранения итогов интервью.'}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Cats Management */}
            {activeTab === 'cats' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Search & Actions Bar */}
                <div className="p-4 sm:p-5 border-b border-stone-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={catSearchTerm}
                      onChange={(e) => setCatSearchTerm(e.target.value)}
                      placeholder="Поиск по имени, породе, окрасу..."
                      className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-stone-800"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={onAddNewCat}
                      className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Добавить котика</span>
                    </button>
                  </div>
                </div>

                {/* Cats List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h4 className="font-bold text-sm text-stone-900">Рейтинг котиков</h4>
                    <span className="text-[11px] text-stone-500 text-right">По добавлениям в избранное</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredCats.map((cat) => (
                      <div
                        key={cat.id}
                        id={`admin-cat-row-${cat.id}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Редактировать анкету котика ${cat.name}`}
                        onClick={() => onEditCat(cat)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onEditCat(cat);
                          }
                        }}
                        className={`p-3.5 rounded-2xl bg-white border hover:border-amber-300 hover:bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs cursor-pointer ${
                          cat.id === newlyAddedCatId ? 'border-amber-400 ring-4 ring-amber-100' : 'border-stone-200'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0 w-full">
                          <img
                            src={cat.photos[0] || realCatPhoto}
                            alt={cat.name}
                            style={{ objectPosition: (cat.primaryPhotoPosition?.x ?? 50) + '% ' + (cat.primaryPhotoPosition?.y ?? 30) + '%' }}
                            className="w-14 h-14 rounded-xl object-cover border border-stone-200 shrink-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = realCatPhoto;
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                              <h5 className="font-bold text-sm text-stone-900 leading-snug break-words min-w-0 max-w-full">
                                {cat.name}
                              </h5>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                  cat.status === 'available'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {cat.status === 'available' ? 'Ищет дом' : 'На бронировании'}
                              </span>
                            </div>
                            <p className="text-xs text-stone-500 mt-1 line-clamp-2 sm:truncate">
                              {cat.breed || 'Метис'} • {cat.age} • {cat.gender === 'male' ? 'Кот' : 'Кошка'}
                            </p>
                            <p className="text-[11px] text-stone-400">
                              Фото: {cat.photos.length} • Видео: {cat.videos?.length || 0}
                            </p>
                            <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                              <span className="inline-flex items-center gap-1 font-bold text-rose-600" title="Добавлений в избранное">
                                <Heart className="w-3.5 h-3.5 fill-rose-500" />
                                {ratingByCatId.get(cat.id)?.likesCount || 0}
                              </span>
                              <span className="text-stone-400">Место: {ratingByCatId.get(cat.id)?.rank || '—'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto shrink-0 pt-2 border-t border-stone-100 sm:pt-0 sm:border-t-0 sm:flex sm:items-center sm:gap-1.5">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onEditCat(cat);
                            }}
                            className="px-2.5 py-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            title="Редактировать анкету"
                          >
                            <Edit3 className="w-4 h-4 text-amber-600" />
                            <span className="text-[11px] font-bold sm:hidden">Изменить</span>
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              if (confirm(`Вы действительно хотите удалить анкету котика «${cat.name}»?`)) {
                                onDeleteCat(cat.id);
                              }
                            }}
                            className="px-2.5 py-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            title="Удалить анкету"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-[11px] font-bold sm:hidden">Удалить</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Articles & Stories Management */}
            {activeTab === 'articles' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-stone-100 bg-white flex items-center justify-between gap-3 shrink-0">
                  <div>
                    <h4 className="font-heading font-extrabold text-sm sm:text-base text-stone-900">
                      Новости, истории и события фонда ({articles.length})
                    </h4>
                    <p className="text-xs text-stone-500">
                      Публикуйте счастливые истории спасения и оповещайте о мероприятиях
                    </p>
                  </div>

                  <button
                    onClick={onOpenPublishArticleModal}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Опубликовать новость</span>
                  </button>
                </div>

                {/* Articles List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                  {articles.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-40 text-stone-300" />
                      <p className="font-semibold text-sm text-stone-700">Нет публикаций</p>
                    </div>
                  ) : (
                    articles.map((art) => (
                      <div
                        key={art.id}
                        id={`admin-article-row-${art.id}`}
                        role={onEditArticle ? 'button' : undefined}
                        tabIndex={onEditArticle ? 0 : undefined}
                        aria-label={onEditArticle ? `Редактировать публикацию «${art.title}»` : undefined}
                        onClick={() => onEditArticle?.(art)}
                        onKeyDown={(event) => {
                          if (!onEditArticle || event.target !== event.currentTarget) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onEditArticle(art);
                          }
                        }}
                        className={`p-4 rounded-2xl bg-white border hover:border-amber-300 hover:bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                          onEditArticle ? 'cursor-pointer' : ''
                        } ${
                          art.id === newlyAddedArticleId ? 'border-amber-400 ring-4 ring-amber-100' : 'border-stone-200'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          {art.coverImage && (
                            <img
                              src={art.coverImage}
                              alt={art.title}
                              style={{ objectPosition: `${art.coverPosition?.x ?? 50}% ${art.coverPosition?.y ?? 50}%` }}
                              className="w-14 h-14 rounded-xl object-cover border border-stone-200 shrink-0"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = realCatPhoto;
                              }}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-bold">
                                {art.category === 'rescue_story'
                                  ? 'Спасение'
                                  : art.category === 'shelter_success'
                                  ? 'Успех'
                                  : 'Мероприятие'}
                              </span>
                              <span className="text-[11px] text-stone-400">{art.publishedAt}</span>
                            </div>
                            <h5 className="font-bold text-sm text-stone-900 mt-1 line-clamp-1">
                              {art.title}
                            </h5>
                            <p className="text-xs text-stone-500 line-clamp-1">{art.summary}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {onEditArticle && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onEditArticle(art);
                              }}
                              className="p-2 rounded-xl text-stone-500 hover:text-amber-700 hover:bg-amber-50 border border-stone-200 transition-colors cursor-pointer"
                              title="Редактировать публикацию"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {onDeleteArticle && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                if (confirm(`Удалить публикацию «${art.title}»?`)) {
                                  onDeleteArticle(art.id);
                                }
                              }}
                              className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 transition-colors cursor-pointer"
                              title="Удалить публикацию"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Public contact details */}
            {activeTab === 'contacts' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <form onSubmit={handleContactsSubmit} className="max-w-3xl p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-sm space-y-5">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-3">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      Контакты сайта
                    </div>
                    <h4 className="font-heading text-xl font-black text-stone-900">Контактная информация</h4>
                    <p className="text-sm text-stone-500 mt-1">
                      Изменения появятся в разделе о фонде, окне помощи, заявках и подвале сайта.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Адрес</span>
                      <input
                        type="text"
                        required
                        value={contactForm.address}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, address: event.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </label>
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Часы и условия посещения</span>
                      <input
                        type="text"
                        required
                        value={contactForm.visitingHours}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, visitingHours: event.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </label>
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Номер телефона</span>
                      <input
                        type="tel"
                        value={contactForm.phone}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, phone: event.target.value }))}
                        placeholder="+7 900 000-00-00"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Подпись Telegram</span>
                      <input
                        type="text"
                        required
                        value={contactForm.telegram}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, telegram: event.target.value }))}
                        placeholder="t.me/название"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Ссылка Telegram</span>
                      <input
                        type="url"
                        required
                        value={contactForm.telegramUrl}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, telegramUrl: event.target.value }))}
                        placeholder="https://t.me/название"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Ссылка на группу MAX</span>
                      <input
                        type="url"
                        value={contactForm.maxUrl}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, maxUrl: event.target.value }))}
                        placeholder="https://max.ru/название"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Ссылка на группу VK</span>
                      <input
                        type="url"
                        value={contactForm.vkUrl}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, vkUrl: event.target.value }))}
                        placeholder="https://vk.com/название"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </label>
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Ссылка на YouTube-канал</span>
                      <input
                        type="url"
                        value={contactForm.youtubeUrl}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, youtubeUrl: event.target.value }))}
                        placeholder="https://www.youtube.com/@название"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </label>
                  </div>

                  {contactsSaveMessage && (
                    <div className={'rounded-xl border px-4 py-3 text-sm font-semibold ' + (
                      contactsSaveMessage.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    )}>
                      {contactsSaveMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingContacts}
                    className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer"
                  >
                    {isSavingContacts ? 'Сохранение…' : 'Сохранить контакты'}
                  </button>
                </form>
              </div>
            )}

            {/* TAB 5: Public shelter counters */}
            {activeTab === 'stats' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <form onSubmit={handleStatsSubmit} className="max-w-2xl p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-sm space-y-5">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-3">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Главная страница
                    </div>
                    <h4 className="font-heading text-xl font-black text-stone-900">Счётчики котиков</h4>
                    <p className="text-sm text-stone-500 mt-1">
                      Эти значения показываются посетителям в верхнем блоке сайта.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1.5">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Уже пристроены</span>
                      <input
                        type="number"
                        min="0"
                        max="1000000"
                        step="1"
                        required
                        value={adoptedCountInput}
                        onChange={(event) => setAdoptedCountInput(event.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Сейчас на передержке</span>
                      <input
                        type="number"
                        min="0"
                        max="1000000"
                        step="1"
                        required
                        value={currentCountInput}
                        onChange={(event) => setCurrentCountInput(event.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </label>
                  </div>

                  {statsSaveMessage && (
                    <div className={'rounded-xl border px-4 py-3 text-sm font-semibold ' + (
                      statsSaveMessage.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    )}>
                      {statsSaveMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingStats}
                    className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer"
                  >
                    {isSavingStats ? 'Сохранение…' : 'Сохранить счётчики'}
                  </button>
                </form>
              </div>
            )}

            {/* Private visit analytics */}
            {activeTab === 'analytics' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-3">
                    <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
                    Только для куратора
                  </div>
                  <h4 className="font-heading text-xl font-black text-stone-900">Динамика посещений</h4>
                  <p className="text-sm text-stone-500 mt-1">
                    Анонимная статистика по браузерам. IP-адреса, имена и контактные данные не сохраняются.
                  </p>
                </div>

                {!visitAnalytics ? (
                  <div className="p-8 rounded-2xl bg-white border border-stone-200 text-center text-stone-500">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-amber-500" />
                    Загружаем статистику…
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { label: 'Сегодня', visitors: visitAnalytics.summary.visitorsToday, visits: visitAnalytics.summary.visitsToday },
                        { label: 'За 7 дней', visitors: visitAnalytics.summary.uniqueVisitors7Days, visits: visitAnalytics.summary.visits7Days },
                        { label: 'За 30 дней', visitors: visitAnalytics.summary.uniqueVisitors30Days, visits: visitAnalytics.summary.visits30Days },
                      ].map((metric) => (
                        <div key={metric.label} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
                          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">{metric.label}</p>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <div className="flex items-center gap-1.5 text-amber-700">
                                <Users className="w-4 h-4" />
                                <span className="font-heading text-2xl font-black">{metric.visitors}</span>
                              </div>
                              <p className="text-[11px] text-stone-500 mt-0.5">уникальных</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 text-stone-700">
                                <Eye className="w-4 h-4" />
                                <span className="font-heading text-2xl font-black">{metric.visits}</span>
                              </div>
                              <p className="text-[11px] text-stone-500 mt-0.5">визитов</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                          <h5 className="font-bold text-stone-900">Последние 30 дней</h5>
                          <p className="text-xs text-stone-500">Наведите на столбец, чтобы увидеть точные значения.</p>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-stone-600">
                          <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-amber-500" />Уникальные</span>
                          <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-stone-400" />Визиты</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto pb-2">
                        <div className="min-w-[760px] h-52 flex items-end gap-1.5 border-b border-stone-200 px-1">
                          {visitAnalytics.daily.map((day, index) => {
                            const visitorsHeight = Math.max(day.visitors > 0 ? 4 : 1, (day.visitors / maxDailyVisits) * 160);
                            const visitsHeight = Math.max(day.visits > 0 ? 4 : 1, (day.visits / maxDailyVisits) * 160);
                            const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
                            return (
                              <div key={day.date} className="flex-1 min-w-5 h-full flex flex-col items-center justify-end" title={`${dateLabel}: уникальных — ${day.visitors}, визитов — ${day.visits}`}>
                                <div className="h-40 flex items-end justify-center gap-0.5">
                                  <div className="w-2.5 rounded-t bg-amber-500" style={{ height: `${visitorsHeight}px` }} />
                                  <div className="w-2.5 rounded-t bg-stone-400" style={{ height: `${visitsHeight}px` }} />
                                </div>
                                <span className="h-6 pt-1 text-[9px] text-stone-400">{index % 3 === 0 || index === visitAnalytics.daily.length - 1 ? dateLabel : ''}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-stone-400">
                      Уникальный посетитель определяется по анонимному cookie браузера. Статистика накапливается с момента включения этого раздела.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* TAB 7: PostgreSQL database management */}
            {activeTab === 'database' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* Status Hero Card */}
                <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-stone-900 to-stone-950 text-white border border-stone-800 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Database className="w-48 h-48 text-amber-400" />
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        PostgreSQL подключена
                      </span>
                      <span className="text-xs text-amber-400 font-mono bg-stone-800/80 px-2 py-0.5 rounded-md border border-stone-700">
                        База: {serverStats?.database || 'загрузка…'}
                      </span>
                    </div>

                    <h4 className="font-heading text-lg sm:text-xl font-black text-white mb-2">
                      Единое хранилище данных и медиа
                    </h4>
                    <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
                      Анкеты котиков, фотографии, загруженные видео, заявки усыновителей, новости и настройки хранятся
                      в PostgreSQL, а не в кеше браузера или JSON-файле. Сайт показывает актуальные данные с любого
                      устройства, а нативная резервная копия PostgreSQL включает как записи, так и все медиафайлы.
                    </p>
                  </div>
                </div>

                {/* Database Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
                    <div className="flex items-center justify-between text-stone-400 mb-1">
                      <span className="text-xs font-semibold">Анкеты котиков</span>
                      <CatIcon className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="font-heading font-black text-2xl text-stone-900">
                      {cats.length}
                    </div>
                    <span className="text-[11px] text-emerald-600 font-medium">в PostgreSQL</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
                    <div className="flex items-center justify-between text-stone-400 mb-1">
                      <span className="text-xs font-semibold">Заявки в БД</span>
                      <ClipboardList className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="font-heading font-black text-2xl text-stone-900">
                      {applications.length}
                    </div>
                    <span className="text-[11px] text-emerald-600 font-medium">в PostgreSQL</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
                    <div className="flex items-center justify-between text-stone-400 mb-1">
                      <span className="text-xs font-semibold">Новости и истории</span>
                      <PenTool className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="font-heading font-black text-2xl text-stone-900">
                      {articles.length}
                    </div>
                    <span className="text-[11px] text-emerald-600 font-medium">в PostgreSQL</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
                    <div className="flex items-center justify-between text-stone-400 mb-1">
                      <span className="text-xs font-semibold">База данных</span>
                      <HardDrive className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="font-heading font-black text-xl text-stone-900 truncate">
                      {serverStats?.database || '—'}
                    </div>
                    <span className="text-[11px] text-emerald-600 font-medium">PostgreSQL</span>
                  </div>
                </div>

                {/* Database Backup & Restore Controls */}
                <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4">
                  <div>
                    <h5 className="font-heading font-bold text-base text-stone-900 mb-1">
                      Управление и резервные копии базы данных
                    </h5>
                    <p className="text-xs text-stone-500">
                      Резервная копия создаётся стандартной утилитой PostgreSQL pg_dump и содержит структуру БД, данные, фотографии и загруженные видео.
                    </p>
                  </div>

                  <form
                    onSubmit={handleBackupScheduleSubmit}
                    className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 font-heading font-bold text-sm text-stone-900">
                          <Clock className="w-4 h-4 text-amber-600" />
                          Автоматический ежедневный backup
                        </div>
                        <p className="mt-1 text-xs text-stone-500">
                          Архивы сохраняются на сервере отдельно от PostgreSQL. Старые копии удаляются автоматически.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        Включён
                      </span>
                    </div>

                    <div>
                      <span className="mb-1.5 block text-xs font-semibold text-stone-700">Папка на сервере</span>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div
                          className="min-w-0 flex-1 truncate rounded-xl border border-stone-200 bg-white px-3 py-2.5 font-mono text-xs text-stone-700"
                          title={backupDirectory}
                        >
                          {backupDirectory || 'Папка не выбрана'}
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenDirectoryBrowser}
                          disabled={isSavingBackupSchedule}
                          className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 transition hover:border-amber-400 hover:bg-amber-50 disabled:opacity-60 cursor-pointer"
                        >
                          <FolderOpen className="w-4 h-4 text-amber-600" />
                          Выбрать папку
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(150px,1fr)_minmax(180px,1fr)_auto] gap-3 items-end">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-stone-700">Время запуска</span>
                        <input
                          type="time"
                          value={backupScheduleTime}
                          onChange={(event) => setBackupScheduleTime(event.target.value)}
                          disabled={isSavingBackupSchedule}
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 disabled:opacity-60"
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-stone-700">Сохранять последних копий</span>
                        <input
                          type="number"
                          min="1"
                          max="90"
                          step="1"
                          value={backupRetentionCount}
                          onChange={(event) => setBackupRetentionCount(event.target.value)}
                          disabled={isSavingBackupSchedule}
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 disabled:opacity-60"
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={isSavingBackupSchedule}
                        className="rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-stone-800 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                      >
                        {isSavingBackupSchedule ? 'Сохраняем…' : 'Сохранить расписание'}
                      </button>
                    </div>

                    {backupSchedule && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-stone-600">
                        <div className="rounded-lg border border-stone-200/80 bg-white/80 px-3 py-2">
                          <span className="block text-stone-400">Следующий запуск</span>
                          <strong className="font-semibold text-stone-700">
                            {backupSchedule.isRunning ? 'Выполняется сейчас…' : formatBackupDate(backupSchedule.nextRunAt)}
                          </strong>
                        </div>
                        <div className="rounded-lg border border-stone-200/80 bg-white/80 px-3 py-2">
                          <span className="block text-stone-400">Последняя успешная копия</span>
                          <strong className="font-semibold text-stone-700">{formatBackupDate(backupSchedule.lastSuccessAt)}</strong>
                        </div>
                        <div className="rounded-lg border border-stone-200/80 bg-white/80 px-3 py-2">
                          <span className="block text-stone-400">Архивов на сервере</span>
                          <strong className="font-semibold text-stone-700">
                            {backupSchedule.storedBackupsCount} из {backupSchedule.retentionCount}
                          </strong>
                        </div>
                      </div>
                    )}

                    {backupSchedule?.lastError && (
                      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        <AlertCircle className="mt-0.5 w-4 h-4 shrink-0" />
                        <span>Ошибка последнего автоматического backup: {backupSchedule.lastError}</span>
                      </div>
                    )}

                    {backupScheduleMessage && (
                      <div
                        role="status"
                        className={`flex items-center gap-2 text-xs font-medium ${
                          backupScheduleMessage.type === 'success' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {backupScheduleMessage.type === 'success'
                          ? <CheckCircle2 className="w-4 h-4" />
                          : <AlertCircle className="w-4 h-4" />}
                        <span>{backupScheduleMessage.text}</span>
                      </div>
                    )}
                  </form>

                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-stone-100">
                    {onExportAllDatabase && (
                      <button
                        type="button"
                        onClick={handleCreateDatabaseBackup}
                        disabled={isCreatingBackup || isRestoringBackup}
                        aria-busy={isCreatingBackup}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:cursor-wait disabled:opacity-60 disabled:hover:bg-amber-500"
                      >
                        {isCreatingBackup ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Создаём резервную копию…</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>Сделать резервную копию БД</span>
                          </>
                        )}
                      </button>
                    )}

                    {onImportAllDatabase && (
                      <label
                        aria-disabled={isCreatingBackup || isRestoringBackup}
                        className={`px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer border border-stone-300 ${
                          isCreatingBackup || isRestoringBackup ? 'pointer-events-none cursor-wait opacity-60' : ''
                        }`}
                      >
                        {isRestoringBackup ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-stone-600" />
                            <span>Восстанавливаем базу…</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-stone-600" />
                            <span>Восстановить БД из резервной копии</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept=".backup,.dump,.pgdump,application/octet-stream"
                          onChange={handleRestoreDatabaseBackup}
                          disabled={isCreatingBackup || isRestoringBackup}
                          className="hidden"
                        />
                      </label>
                    )}

                  </div>

                  {(isCreatingBackup || isRestoringBackup) && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs sm:text-sm text-amber-900"
                    >
                      <RefreshCw className="mt-0.5 w-4 h-4 shrink-0 animate-spin text-amber-600" />
                      <span>
                        {isCreatingBackup
                          ? 'Создаём резервную копию. Окно сохранения появится после подготовки файла.'
                          : 'Восстанавливаем базу данных. Не закрывайте страницу до завершения операции.'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isDirectoryBrowserOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-stone-950/70 p-3 sm:p-6 backdrop-blur-sm"
          onClick={(event) => event.stopPropagation()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="server-directory-browser-title"
            className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h3 id="server-directory-browser-title" className="font-heading text-base font-bold text-stone-900">
                  Выберите папку на сервере
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Здесь показаны диски и папки компьютера, на котором запущен сайт.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectoryBrowserOpen(false)}
                className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
                aria-label="Закрыть выбор папки"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => loadServerDirectory(directoryListing?.parentPath || undefined)}
                disabled={isDirectoryLoading || (!directoryListing?.currentPath && !directoryListing?.parentPath)}
                className="rounded-lg border border-stone-200 bg-white p-2 text-stone-600 transition hover:border-amber-400 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                aria-label="На уровень выше"
                title="На уровень выше"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => loadServerDirectory()}
                disabled={isDirectoryLoading}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-amber-400 hover:text-amber-700 disabled:opacity-40 cursor-pointer"
              >
                Диски
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNewDirectoryFormOpen((open) => !open);
                  setNewDirectoryName('');
                  setNewDirectoryError('');
                }}
                disabled={isDirectoryLoading || !directoryListing?.currentPath}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-amber-400 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Новая папка</span>
              </button>
              <div
                className="min-w-0 flex-1 truncate rounded-lg border border-stone-200 bg-white px-3 py-2 font-mono text-xs text-stone-700"
                title={directoryListing?.currentPath || 'Этот компьютер'}
              >
                {directoryListing?.currentPath || 'Этот компьютер'}
              </div>
            </div>

            <div className="min-h-56 flex-1 overflow-y-auto p-3 sm:p-4">
              {isNewDirectoryFormOpen && directoryListing?.currentPath && (
                <form
                  onSubmit={handleCreateServerDirectory}
                  className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3"
                >
                  <label className="block text-xs font-semibold text-stone-700" htmlFor="new-server-backup-directory">
                    Имя новой папки
                  </label>
                  <div className="mt-2 flex flex-col sm:flex-row gap-2">
                    <input
                      id="new-server-backup-directory"
                      type="text"
                      value={newDirectoryName}
                      onChange={(event) => {
                        setNewDirectoryName(event.target.value);
                        setNewDirectoryError('');
                      }}
                      placeholder="Например: Резервные копии сайта"
                      maxLength={255}
                      disabled={isCreatingDirectory}
                      autoFocus
                      className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={isCreatingDirectory || !newDirectoryName.trim()}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      {isCreatingDirectory ? 'Создаём…' : 'Создать'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewDirectoryFormOpen(false);
                        setNewDirectoryName('');
                        setNewDirectoryError('');
                      }}
                      disabled={isCreatingDirectory}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-100 disabled:opacity-50 cursor-pointer"
                    >
                      Отмена
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-stone-500">
                    Можно использовать русские буквы, цифры, дефисы и пробелы.
                  </p>
                  {newDirectoryError && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-red-700">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{newDirectoryError}</span>
                    </div>
                  )}
                </form>
              )}

              {isDirectoryLoading ? (
                <div className="flex h-40 items-center justify-center gap-2 text-sm text-stone-500">
                  <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
                  Загружаем папки…
                </div>
              ) : directoryBrowserError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{directoryBrowserError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadServerDirectory()}
                    className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold transition hover:bg-red-100 cursor-pointer"
                  >
                    Вернуться к дискам
                  </button>
                </div>
              ) : directoryListing?.directories.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {directoryListing.directories.map((directory) => (
                    <button
                      key={directory.path}
                      type="button"
                      onClick={() => loadServerDirectory(directory.path)}
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-stone-200 px-3 py-3 text-left transition hover:border-amber-400 hover:bg-amber-50 cursor-pointer"
                      title={directory.path}
                    >
                      <Folder className="h-5 w-5 shrink-0 fill-amber-100 text-amber-600" />
                      <span className="truncate text-sm font-semibold text-stone-700">{directory.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-stone-400">
                  В этой папке нет вложенных папок
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-stone-200 bg-stone-50 px-4 py-3 sm:px-5">
              <span className="truncate text-[11px] text-stone-500" title={directoryListing?.currentPath || ''}>
                {directoryListing?.currentPath ? `Будет выбрана: ${directoryListing.currentPath}` : 'Откройте диск и нужную папку'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDirectoryBrowserOpen(false)}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 transition hover:bg-stone-100 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSelectBackupDirectory}
                  disabled={!directoryListing?.currentPath || isDirectoryLoading}
                  className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  Выбрать эту папку
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


































