import React, { useState } from 'react';
import { getCatStatusLabel } from '../utils/catStatus';
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
import { Cat, AdoptionApplication, ApplicationStatus, ShelterArticle, ShelterStats, SiteContacts, UserAccount, OwnerContentKind } from '../types';
import realCatPhoto from '../assets/defaultCat';
import {
  apiLogin,
  apiGetAdminSession,
  apiLogoutAdmin,
  apiChangeAdminPassword,
  apiRegisterOwner,
  apiRequestPasswordReset,
  apiResetPassword,
  apiResendVerification,
  apiVerifyRegistration,
  apiAcceptCatInvite,
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
import { PASSWORD_PATTERN, PASSWORD_REQUIREMENTS } from '../utils/password';
import { OwnerDashboard } from './OwnerDashboard';
import { PasswordInput } from './PasswordInput';
import { UsersManagement } from './UsersManagement';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  initialOwnerCatId?: string | null;
  initialOwnerContentKind?: Extract<OwnerContentKind, 'photo' | 'video'> | null;
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
  onApplicationViewed: (id: string) => Promise<void>;
  onUpdateApplicationStatus: (id: string, newStatus: ApplicationStatus, notes?: string) => void;
  onDeleteApplication: (id: string) => void;
  // Database backup & actions
  onExportAllDatabase?: () => Promise<void> | void;
  onImportAllDatabase?: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void> | void;
  onAuthenticated: () => Promise<void> | void;
}

type AdminTabId = 'applications' | 'cats' | 'articles' | 'users' | 'stats' | 'contacts' | 'analytics' | 'database';

const DEFAULT_ADMIN_TAB: AdminTabId = 'applications';
const ADMIN_TAB_STORAGE_PREFIX = 'shelter:admin-dashboard-tab:';
const ADMIN_TAB_IDS: ReadonlySet<AdminTabId> = new Set([
  'applications',
  'cats',
  'articles',
  'users',
  'stats',
  'contacts',
  'analytics',
  'database',
]);

const getAdminTabStorageKey = (email: string) => `${ADMIN_TAB_STORAGE_PREFIX}${email.trim().toLowerCase()}`;

const getSavedAdminTab = (user: UserAccount): AdminTabId => {
  try {
    const savedTab = window.localStorage.getItem(getAdminTabStorageKey(user.email));
    if (!savedTab || !ADMIN_TAB_IDS.has(savedTab as AdminTabId)) return DEFAULT_ADMIN_TAB;
    if (savedTab === 'database' && user.role !== 'administrator') return DEFAULT_ADMIN_TAB;
    return savedTab as AdminTabId;
  } catch {
    return DEFAULT_ADMIN_TAB;
  }
};

const saveAdminTab = (user: UserAccount, tabId: AdminTabId) => {
  try {
    window.localStorage.setItem(getAdminTabStorageKey(user.email), tabId);
  } catch {
    // The selected tab still works when browser storage is unavailable.
  }
};

const creationTimestamp = (createdAt?: string): number => {
  const timestamp = createdAt ? Date.parse(createdAt) : Number.NaN;
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
};

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
  initialOwnerCatId,
  initialOwnerContentKind,
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
  onApplicationViewed,
  onUpdateApplicationStatus,
  onDeleteApplication,
  onExportAllDatabase,
  onImportAllDatabase,
  onAuthenticated,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const passwordInputRef = React.useRef<HTMLInputElement>(null);
  const [loginError, setLoginError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authMode, setAuthMode] = useState<'choice' | 'login' | 'register' | 'verify' | 'forgot' | 'reset'>('login');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [passwordConfirmInput, setPasswordConfirmInput] = useState('');
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [inviteCatId, setInviteCatId] = useState('');
  const [inviteSignature, setInviteSignature] = useState('');
  const [linkedApplicationId] = useState(() => new URLSearchParams(window.location.search).get('application') || '');
  const linkedApplicationHandledRef = React.useRef(false);
  const [activeTab, setActiveTab] = useState<AdminTabId>(DEFAULT_ADMIN_TAB);
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
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [isOpen]);

  React.useEffect(() => {
    const handleSessionExpired = () => { setIsAuthenticated(false); setCurrentUser(null); };
    const handleSessionAuthenticated = () => {
      apiGetAdminSession().then((session) => {
        setIsAuthenticated(session.authenticated);
        setCurrentUser(session.user || null);
      });
    };
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
      .then(async (session) => {
        if (cancelled) return;
        let user = session.user || null;
        const params = new URLSearchParams(window.location.search);
        const catId = params.get('catId');
        const invite = params.get('invite');
        if (session.authenticated && user?.role === 'owner' && catId && invite) {
          user = await apiAcceptCatInvite(catId, invite);
          window.history.replaceState(null, '', window.location.pathname);
          setAuthMessage(`Котик ${cats.find((cat) => cat.id === catId)?.name || ''} привязан к вашему аккаунту.`.trim());
        }
        setIsAuthenticated(session.authenticated);
        setCurrentUser(user);
        setIsCheckingSession(false);
        if (session.authenticated && user?.role !== 'owner') {
          void Promise.resolve(onAuthenticated()).catch(() => {});
        }
      })
      .catch((error) => {
        if (!cancelled) setLoginError(error instanceof Error ? error.message : 'Не удалось открыть ссылку котика');
      })
      .finally(() => {
        if (!cancelled) setIsCheckingSession(false);
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const params = new URLSearchParams(window.location.search);
    const passwordResetToken = params.get('reset');
    const catId = params.get('catId') || '';
    const invite = params.get('invite') || '';
    setInviteCatId(catId);
    setInviteSignature(invite);
    if (params.has('register')) setAuthMode(catId && invite ? 'choice' : 'register');
    if (passwordResetToken) {
      setResetToken(passwordResetToken);
      setAuthMode('reset');
    }
    if (params.has('verify')) {
      setAuthMode('verify');
      setLoginError('Ссылки подтверждения больше не используются. Запросите новый шестизначный код.');
      window.history.replaceState(null, '', window.location.pathname);
    }
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
    if (currentUser?.role === 'owner') return;
    const refreshApplications = async () => {
      const session = await apiGetAdminSession();
      if (!session.authenticated) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        return;
      }
      await Promise.resolve(onAuthenticated()).catch(() => {});
    };
    const intervalId = window.setInterval(refreshApplications, 5000);
    return () => window.clearInterval(intervalId);
  }, [isOpen, isAuthenticated, currentUser?.role]);

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
  const autoReviewingIdsRef = React.useRef(new Set<string>());

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
      email: contactForm.email.trim(),
      telegram: contactForm.telegram.trim(),
      telegramUrl: contactForm.telegramUrl.trim(),
      maxUrl: contactForm.maxUrl.trim(),
      vkUrl: contactForm.vkUrl.trim(),
      youtubeUrl: contactForm.youtubeUrl.trim(),
      rutubeUrl: contactForm.rutubeUrl.trim(),
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

  const formatFileSize = (sizeBytes: number | null | undefined) => {
    if (sizeBytes === null || sizeBytes === undefined || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
      return 'неизвестно';
    }
    const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
    let value = sizeBytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: unitIndex === 0 ? 0 : 1,
      maximumFractionDigits: unitIndex === 0 ? 0 : 2,
    }).format(value)} ${units[unitIndex]}`;
  };

  const formatBackupFilesCount = (count: number) => {
    const mod100 = count % 100;
    const mod10 = count % 10;
    const word = mod100 >= 11 && mod100 <= 14
      ? 'файлов'
      : mod10 === 1
        ? 'файл'
        : mod10 >= 2 && mod10 <= 4
          ? 'файла'
          : 'файлов';
    return `${count} ${word}`;
  };

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const session = await apiLogin(emailInput, passwordInput, inviteCatId || undefined, inviteSignature || undefined);
      if (!session.authenticated || !session.user) throw new Error('Неверное имя пользователя или пароль.');
      setIsAuthenticated(true);
      setCurrentUser(session.user);
      setLoginError('');
      setAuthMessage('');
      setPasswordInput('');
      if (inviteCatId) window.history.replaceState(null, '', window.location.pathname);
      if (session.user.role !== 'owner') await onAuthenticated();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Неверное имя пользователя или пароль.');
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError('');
    try {
      const result = await apiRegisterOwner(emailInput, passwordInput, passwordConfirmInput, displayNameInput, inviteCatId || undefined, inviteSignature || undefined);
      setAuthMessage(result.message);
      setAuthMode('verify');
      setPasswordInput('');
      setPasswordConfirmInput('');
    } catch (error) { setLoginError(error instanceof Error ? error.message : 'Не удалось зарегистрироваться'); }
  };

  const handleVerifyRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError('');
    try {
      const result = await apiVerifyRegistration(emailInput, verificationCodeInput);
      setAuthMessage(result.message);
      setAuthMode('login');
      setVerificationCodeInput('');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Не удалось подтвердить регистрацию');
    }
  };

  const handleResendVerification = async () => {
    setLoginError('');
    try {
      const result = await apiResendVerification(emailInput);
      setAuthMessage(result.message);
      setVerificationCodeInput('');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Не удалось отправить новый код');
    }
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError('');
    try {
      const result = await apiRequestPasswordReset(emailInput);
      setAuthMessage(result.message);
      setAuthMode('login');
    } catch (error) { setLoginError(error instanceof Error ? error.message : 'Не удалось отправить письмо'); }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError('');
    try {
      const result = await apiResetPassword(resetToken, passwordInput, passwordConfirmInput);
      setAuthMessage(result.message);
      setAuthMode('login');
      setPasswordInput('');
      setPasswordConfirmInput('');
      window.history.replaceState(null, '', window.location.pathname);
    } catch (error) { setLoginError(error instanceof Error ? error.message : 'Не удалось изменить пароль'); }
  };

  const handleLogout = async () => {
    await apiLogoutAdmin().catch(() => {});
    setIsAuthenticated(false);
    setCurrentUser(null);
    setPasswordInput('');
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasswordInput.length < 4) {
      setPasswordChangeMessage({ type: 'error', text: 'Новый пароль должен содержать минимум 4 символа' });
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

  // Cats filtering: curator view is chronological, from oldest to newest.
  const ratingByCatId = new Map(catRatings.map((rating) => [rating.catId, rating]));
  const filteredCats = cats.filter((cat) =>
    cat.name.toLowerCase().includes(catSearchTerm.toLowerCase()) ||
    cat.breed.toLowerCase().includes(catSearchTerm.toLowerCase()) ||
    cat.color.toLowerCase().includes(catSearchTerm.toLowerCase())
  ).sort((left, right) =>
    creationTimestamp(left.createdAt) - creationTimestamp(right.createdAt)
    || left.id.localeCompare(right.id)
  );
  const chronologicalArticles = [...articles].sort((left, right) =>
    creationTimestamp(left.createdAt) - creationTimestamp(right.createdAt)
    || left.id.localeCompare(right.id)
  );

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

  const allAdminTabs: ReadonlyArray<{
    id: AdminTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'applications', label: 'Заявки', icon: ClipboardList, count: applications.length },
    { id: 'cats', label: 'Котики', icon: CatIcon, count: cats.length },
    { id: 'articles', label: 'Новости', icon: PenTool, count: articles.length },
    { id: 'users', label: 'Пользователи', icon: Users },
    { id: 'contacts', label: 'Параметры организации', icon: MapPin },
    { id: 'stats', label: 'Счётчики', icon: Sparkles },
    { id: 'analytics', label: 'Посещения', icon: BarChart3 },
    { id: 'database', label: 'База данных', icon: Database },
  ];
  const adminTabs = allAdminTabs.filter((tab) => currentUser?.role === 'administrator' || tab.id !== 'database');
  const activeAdminTab = adminTabs.find((tab) => tab.id === activeTab) || adminTabs[0];
  const ActiveAdminTabIcon = activeAdminTab.icon;

  React.useEffect(() => {
    if (!isAuthenticated || !currentUser || currentUser.role === 'owner') return;
    setActiveTab(linkedApplicationId ? 'applications' : getSavedAdminTab(currentUser));
  }, [currentUser?.email, currentUser?.role, isAuthenticated, linkedApplicationId]);

  React.useEffect(() => {
    if (!isOpen || !isAuthenticated || currentUser?.role === 'owner' || !linkedApplicationId || linkedApplicationHandledRef.current) return;
    if (activeTab !== 'applications') {
      setActiveTab('applications');
      return;
    }
    if (appSearchTerm || appStatusFilter !== 'all') {
      setAppSearchTerm('');
      setAppStatusFilter('all');
      return;
    }
    if (!applications.some((application) => application.id === linkedApplicationId)) return;

    linkedApplicationHandledRef.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('application');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);

    const frameId = window.requestAnimationFrame(() => {
      const applicationCard = document.getElementById(`admin-application-${linkedApplicationId}`);
      if (!applicationCard) return;
      applicationCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      applicationCard.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, appSearchTerm, appStatusFilter, applications, currentUser?.role, isAuthenticated, isOpen, linkedApplicationId]);

  React.useEffect(() => {
    if (!isOpen || !isAuthenticated || currentUser?.role === 'owner' || activeTab !== 'applications') return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.2) return;
        const applicationId = (entry.target as HTMLElement).dataset.applicationId;
        if (!applicationId || autoReviewingIdsRef.current.has(applicationId)) return;
        autoReviewingIdsRef.current.add(applicationId);
        observer.unobserve(entry.target);
        void onApplicationViewed(applicationId).catch(() => {
          autoReviewingIdsRef.current.delete(applicationId);
        });
      });
    }, { threshold: [0.2] });

    const frameId = window.requestAnimationFrame(() => {
      applications
        .filter((application) => application.status === 'new')
        .forEach((application) => {
          const card = document.getElementById(`admin-application-${application.id}`);
          if (card) observer.observe(card);
        });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [activeTab, appSearchTerm, appStatusFilter, applications, currentUser?.role, isAuthenticated, isOpen, onApplicationViewed]);

  const selectAdminTab = (tabId: AdminTabId) => {
    if (currentUser && currentUser.role !== 'owner') saveAdminTab(currentUser, tabId);
    setActiveTab(tabId);
    setIsMobileTabMenuOpen(false);
  };

  const maxDailyVisits = Math.max(1, ...(visitAnalytics?.daily.map((day) => day.visits) || [1]));
  const invitedCatName = cats.find((cat) => cat.id === inviteCatId)?.name || 'котика';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-stone-950/70 backdrop-blur-md overflow-hidden overscroll-none animate-in fade-in duration-200"
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
        className="relative w-full h-full sm:h-[92vh] max-w-5xl bg-white rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col border-0 sm:border border-stone-200"
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
                  {currentUser?.role === 'administrator'
                    ? 'Панель администратора'
                    : currentUser?.role === 'curator'
                      ? 'Панель куратора'
                      : currentUser?.role === 'owner'
                        ? 'Панель управления'
                        : 'Авторизация и вход в личный кабинет'}
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
                  <h4 className="font-bold text-stone-900 text-sm">Смена пароля</h4>
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
                  <PasswordInput
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
                  <PasswordInput
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    minLength={4}
                    maxLength={200}
                    pattern={PASSWORD_PATTERN}
                    title={PASSWORD_REQUIREMENTS}
                    placeholder="Минимум 4 символа"
                    required
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-stone-500">{PASSWORD_REQUIREMENTS}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Подтвердите новый пароль
                  </label>
                  <PasswordInput
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
          <div className="p-6 sm:p-12 flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-4" />
            <p className="text-sm font-semibold text-stone-700">Проверяем доступ к кабинету…</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="p-6 sm:p-12 flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center justify-start max-w-md mx-auto w-full text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mb-5 shadow-inner">
              <KeyRound className="w-8 h-8" />
            </div>

            <h4 className="font-heading font-extrabold text-2xl text-stone-900 mb-2">
              {authMode === 'choice' ? `Котик ${invitedCatName} едет домой` : authMode === 'register' ? 'Регистрация нового хозяина' : authMode === 'verify' ? 'Подтверждение e-mail' : authMode === 'forgot' ? 'Восстановление пароля' : authMode === 'reset' ? 'Новый пароль' : 'Вход в личный кабинет'}
            </h4>
            <p className="text-sm text-stone-600 mb-6">
              {authMode === 'choice'
                ? 'Выберите, как привязать котика к вашему личному кабинету.'
                : authMode === 'register'
                ? 'Укажите e-mail, пароль и имя, которое увидят сотрудники фонда.'
                : authMode === 'verify'
                  ? 'Введите шестизначный код, который мы отправили на ваш e-mail. Код действует 30 минут.'
                : authMode === 'forgot'
                  ? 'Мы отправим ссылку для создания нового пароля на указанный e-mail.'
                  : authMode === 'reset'
                    ? PASSWORD_REQUIREMENTS
                    : 'Войдите как администратор, куратор или новый хозяин котика.'}
            </p>

            {authMode === 'choice' ? (
              <div className="w-full space-y-3">
                <button type="button" onClick={() => { setAuthMode('login'); setLoginError(''); }} className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md shadow-amber-500/20 transition-all">У меня уже есть аккаунт</button>
                <button type="button" onClick={() => { setAuthMode('register'); setLoginError(''); }} className="w-full py-3 px-4 rounded-2xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-sm transition-all">Зарегистрироваться</button>
                {loginError && <p className="text-xs text-rose-600 font-semibold">{loginError}</p>}
              </div>
            ) : <form onSubmit={authMode === 'register' ? handleRegister : authMode === 'verify' ? handleVerifyRegistration : authMode === 'forgot' ? handleForgotPassword : authMode === 'reset' ? handleResetPassword : handleLogin} className="w-full space-y-4">
              <div className="text-left">
                {authMode !== 'reset' && <>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (loginError) setLoginError('');
                    }}
                    placeholder="name@example.com"
                    autoFocus={authMode !== 'verify'}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-stone-900"
                  />
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                </div>
                </>}
                {authMode === 'register' && <div className="mt-3">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Отображаемое имя <span className="normal-case font-normal text-stone-400">необязательно</span></label>
                  <input value={displayNameInput} onChange={(event) => setDisplayNameInput(event.target.value)} maxLength={120} placeholder="Как к вам обращаться" className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                </div>}
                {authMode === 'verify' && <div className="mt-3">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Код подтверждения</label>
                  <input
                    value={verificationCodeInput}
                    onChange={(event) => {
                      setVerificationCodeInput(event.target.value.replace(/\D/g, '').slice(0, 6));
                      setLoginError('');
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    placeholder="000000"
                    autoFocus
                    required
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-2xl text-center text-2xl font-bold tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>}
                {['login', 'register', 'reset'].includes(authMode) && <div className="mt-3">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Пароль</label>
                  <div className="relative">
                    <PasswordInput ref={passwordInputRef} value={passwordInput} onChange={(event) => { setPasswordInput(event.target.value); setLoginError(''); }} minLength={['register', 'reset'].includes(authMode) ? 4 : undefined} maxLength={['register', 'reset'].includes(authMode) ? 200 : undefined} pattern={['register', 'reset'].includes(authMode) ? PASSWORD_PATTERN : undefined} title={['register', 'reset'].includes(authMode) ? PASSWORD_REQUIREMENTS : undefined} required className="w-full pl-10 py-3 bg-stone-50 border border-stone-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>}
                {['register', 'reset'].includes(authMode) && <div className="mt-3">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">Подтверждение пароля</label>
                  <PasswordInput value={passwordConfirmInput} onChange={(event) => setPasswordConfirmInput(event.target.value)} placeholder="Повторите пароль" className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  <p className="mt-1.5 text-[11px] text-stone-500">{PASSWORD_REQUIREMENTS}</p>
                </div>}
                {authMessage && <p className="mt-3 p-3 rounded-xl bg-emerald-50 text-xs text-emerald-800 text-left break-words">{authMessage}</p>}
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
                <span>{authMode === 'register' ? 'Зарегистрироваться' : authMode === 'verify' ? 'Подтвердить e-mail' : authMode === 'forgot' ? 'Отправить письмо' : authMode === 'reset' ? 'Сохранить новый пароль' : 'Войти'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              {authMode === 'login' ? (
                <div className="flex items-center justify-center gap-4 text-xs font-semibold">
                  <button type="button" onClick={() => { setAuthMode('register'); setLoginError(''); setAuthMessage(''); }} className="text-amber-700 hover:text-amber-900">Регистрация</button>
                  <button type="button" onClick={() => { setAuthMode('forgot'); setLoginError(''); setAuthMessage(''); }} className="text-stone-600 hover:text-stone-900">Забыли пароль?</button>
                </div>
              ) : (
                <button type="button" onClick={() => { setAuthMode('login'); setLoginError(''); }} className="text-xs font-semibold text-stone-600 hover:text-stone-900">Вернуться ко входу</button>
              )}
              {authMode === 'verify' && (
                <button type="button" onClick={handleResendVerification} className="text-xs font-semibold text-amber-700">Отправить новый код</button>
              )}
              {authMode === 'login' && loginError.includes('шестизначным кодом') && (
                <button type="button" onClick={() => { setAuthMode('verify'); setLoginError(''); setAuthMessage(''); }} className="text-xs font-semibold text-amber-700">Ввести код подтверждения</button>
              )}
            </form>}
          </div>
        ) : currentUser?.role === 'owner' ? (
          <OwnerDashboard user={currentUser} onUserChange={setCurrentUser} initialCatId={initialOwnerCatId} initialContentKind={initialOwnerContentKind} />
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
              <div className="hidden lg:grid grid-cols-8 gap-2 w-full">
                <button
                  onClick={() => selectAdminTab('applications')}
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
                  onClick={() => selectAdminTab('cats')}
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
                  onClick={() => selectAdminTab('articles')}
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
                  onClick={() => selectAdminTab('users')}
                  className={'min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ' + (
                    activeTab === 'users' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  )}
                >
                  <Users className="w-4 h-4" />
                  <span>Пользователи</span>
                </button>

                <button
                  onClick={() => selectAdminTab('contacts')}
                  className={'min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ' + (
                    activeTab === 'contacts'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  )}
                >
                  <MapPin className="w-4 h-4" />
                  <span>Параметры</span>
                </button>

                <button
                  onClick={() => selectAdminTab('stats')}
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
                  onClick={() => selectAdminTab('analytics')}
                  className={'min-w-0 px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ' + (
                    activeTab === 'analytics'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Посещения</span>
                </button>

                {currentUser?.role === 'administrator' && <button
                  onClick={() => selectAdminTab('database')}
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
                </button>}
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

            {activeTab === 'users' && currentUser && <UsersManagement
              cats={cats}
              currentUser={currentUser}
              onChangeOwnPassword={() => {
                setIsChangePasswordOpen(true);
                setPasswordChangeMessage(null);
                setOldPasswordInput('');
                setNewPasswordInput('');
                setNewPasswordConfirm('');
              }}
            />}

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
                          id={`admin-application-${app.id}`}
                          data-application-id={app.id}
                          tabIndex={-1}
                          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition-colors focus:outline-none ${
                            app.id === linkedApplicationId
                              ? 'border-amber-500 ring-4 ring-amber-200/70'
                              : 'border-stone-200 hover:border-amber-300'
                          }`}
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
                    <h4 className="font-bold text-sm text-stone-900">Анкеты котиков</h4>
                    <span className="text-[11px] text-stone-500 text-right">Сначала добавленные ранее</span>
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
                                    : cat.status === 'reserved'
                                      ? 'bg-amber-100 text-amber-800'
                                      : cat.status === 'trial'
                                        ? 'bg-sky-100 text-sky-800'
                                        : 'bg-stone-200 text-stone-700'
                                }`}
                              >
                                {getCatStatusLabel(cat.status, cat.gender)}
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
                    chronologicalArticles.map((art) => (
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
                                  : art.category === 'resources'
                                  ? 'Ресурсы и обеспечение'
                                  : 'Мероприятие'}
                              </span>
                              <span className="text-[11px] text-stone-400">{art.publishedAt}</span>
                              {art.fundraisingClosed && (
                                <span className="px-2 py-0.5 rounded-md bg-stone-900 text-white text-[10px] font-bold">Сбор закрыт</span>
                              )}
                              {art.issueClosed && (
                                <span className="px-2 py-0.5 rounded-md bg-stone-900 text-white text-[10px] font-bold">Вопрос закрыт</span>
                              )}
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
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">E-mail организации</span>
                      <input
                        type="email"
                        value={contactForm.email}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))}
                        placeholder="info@example.ru"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <span className="block text-xs text-stone-500">Отображается в разделе «Контакты» на главной странице.</span>
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
                    <label className="space-y-1.5">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Ссылка на YouTube-канал</span>
                      <input
                        type="url"
                        value={contactForm.youtubeUrl}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, youtubeUrl: event.target.value }))}
                        placeholder="https://www.youtube.com/@название"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="block text-xs font-bold text-stone-700 uppercase tracking-wider">Ссылка на RUTUBE-канал</span>
                      <input
                        type="url"
                        value={contactForm.rutubeUrl}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, rutubeUrl: event.target.value }))}
                        placeholder="https://rutube.ru/channel/00000000"
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
                {/* Database status */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-950 text-white border border-stone-800 shadow-xl relative overflow-hidden">
                  <div className="absolute -top-5 right-2 opacity-10 pointer-events-none">
                    <Database className="w-20 h-20 text-amber-400" />
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        PostgreSQL подключена
                      </span>
                      <span className="text-xs text-amber-400 font-mono bg-stone-800/80 px-2 py-0.5 rounded-md border border-stone-700">
                        База: {serverStats?.database || 'загрузка…'}
                      </span>
                    </div>
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
                      <div className="space-y-3">
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

                        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white/90">
                          <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <HardDrive className="h-4 w-4 text-amber-600" />
                              <span className="text-xs font-bold text-stone-800">Созданные резервные копии</span>
                            </div>
                            <span className="text-[10px] font-semibold text-stone-400">
                              {formatBackupFilesCount(backupSchedule.storedBackupsCount)}
                            </span>
                          </div>

                          {backupSchedule.storedBackups.length > 0 ? (
                            <div className="divide-y divide-stone-100">
                              {backupSchedule.storedBackups.map((file) => (
                                <div key={file.fileName} className="flex items-start justify-between gap-3 px-3 py-2.5 text-[11px]">
                                  <div className="min-w-0">
                                    <div className="break-all font-mono font-semibold text-stone-700" title={file.fileName}>
                                      {file.fileName}
                                    </div>
                                    <div className="mt-0.5 text-stone-400">
                                      Создан: {formatBackupDate(file.createdAt)}
                                    </div>
                                  </div>
                                  <strong className="shrink-0 whitespace-nowrap font-semibold text-stone-700">
                                    {formatFileSize(file.sizeBytes)}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="px-3 py-5 text-center text-xs text-stone-400">
                              Автоматические резервные копии ещё не созданы.
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-px border-t border-stone-200 bg-stone-200 sm:grid-cols-2">
                            <div className="bg-stone-50 px-3 py-2.5 text-[11px]">
                              <span className="block text-stone-400">Общий объём архивов</span>
                              <strong className="font-semibold text-stone-700">
                                {formatFileSize(backupSchedule.storedBackupsTotalSizeBytes)}
                              </strong>
                            </div>
                            <div className="bg-stone-50 px-3 py-2.5 text-[11px]">
                              <span className="block text-stone-400">Свободно на диске</span>
                              <strong className="font-semibold text-stone-700">
                                {formatFileSize(backupSchedule.diskFreeSpaceBytes)}
                              </strong>
                            </div>
                          </div>
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


































