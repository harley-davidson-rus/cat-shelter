import React, { useState } from 'react';
import { X, CheckCircle2, ShieldAlert, Sparkles, HeartHandshake, Phone, Mail, Home, User, Info } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Cat, AdoptionApplication, HousingType } from '../types';

interface AdoptionModalProps {
  cat: Cat | null;
  allCats: Cat[];
  isOpen: boolean;
  onClose: () => void;
  onSubmitApplication: (app: Omit<AdoptionApplication, 'id' | 'createdAt' | 'status'>) => Promise<AdoptionApplication>;
  onViewMyApplications: () => void;
}

export const AdoptionModal: React.FC<AdoptionModalProps> = ({
  cat,
  allCats,
  isOpen,
  onClose,
  onSubmitApplication,
  onViewMyApplications,
}) => {
  if (!isOpen) return null;

  // Selected cat state (defaults to passed cat or first available cat)
  const [selectedCatId, setSelectedCatId] = useState<string>(
    cat?.status === 'available' ? cat.id : allCats[0]?.id || '',
  );

  // Form Fields
  const [applicantName, setApplicantName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [housingType, setHousingType] = useState<HousingType>('own_apartment');
  const [hasWindowScreens, setHasWindowScreens] = useState<boolean>(true);
  const [hasOtherPets, setHasOtherPets] = useState<boolean>(false);
  const [otherPetsDescription, setOtherPetsDescription] = useState('');
  const [hasExperience, setHasExperience] = useState<boolean>(true);
  const [experienceDescription, setExperienceDescription] = useState('');
  const [familyAgreement, setFamilyAgreement] = useState<boolean>(true);
  const [readyForCare, setReadyForCare] = useState<boolean>(true);
  const [comment, setComment] = useState('');

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAppId, setSubmittedAppId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentCat = allCats.find((c) => c.id === selectedCatId) || null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!applicantName.trim()) {
      newErrors.applicantName = 'Укажите ваше имя и фамилию';
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 7) {
      newErrors.phone = 'Укажите корректный номер телефона для связи';
    }
    if (!email.trim() || !email.includes('@')) {
      newErrors.email = 'Укажите действующий адрес электронной почты';
    }
    if (!city.trim()) {
      newErrors.city = 'Укажите город или район проживания';
    }
    if (!familyAgreement) {
      newErrors.familyAgreement = 'Необходимо согласие всех совершеннолетних членов семьи';
    }
    if (!readyForCare) {
      newErrors.readyForCare = 'Подтвердите готовность к вакцинации и заботе';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !currentCat) return;

    setIsSubmitting(true);
    setErrors((prev) => {
      const { submit: _submit, ...rest } = prev;
      return rest;
    });

    try {
      const submittedApplication = await onSubmitApplication({
        catId: currentCat.id,
        catName: currentCat.name,
        catPhoto: currentCat.photos[0],
        applicantName,
        phone,
        email,
        city,
        housingType,
        hasWindowScreens,
        hasOtherPets,
        otherPetsDescription,
        hasExperience,
        experienceDescription,
        familyAgreement,
        comment,
      });

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#10b981', '#fb7185', '#38bdf8'],
        });
      } catch {
        // Canvas may be unavailable.
      }

      setSubmittedAppId(submittedApplication.id);
    } catch {
      setErrors((prev) => ({
        ...prev,
        submit: 'Не удалось отправить заявку. Проверьте соединение и повторите попытку.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleResetAndClose = () => {
    setSubmittedAppId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div
        id="adoption-modal-container"
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading text-base sm:text-lg leading-tight font-bold text-stone-900">
                Заявка на усыновление котика
              </h3>
              <p className="text-xs text-stone-500 truncate mt-1">
                {currentCat ? `Выбран подопечный: ${currentCat.name}` : 'Выберите котика'}
              </p>
            </div>
          </div>

          <button
            id="close-adoption-modal-btn"
            onClick={handleResetAndClose}
            className="p-2 rounded-full hover:bg-stone-200 text-stone-600 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-6">
          {submittedAppId ? (
            /* Success State */
            <div className="text-center py-8 px-4 space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold tracking-wide">
                  Номер заявки: {submittedAppId}
                </span>
                <h4 className="font-heading text-2xl font-black text-stone-900">
                  Заявка на {currentCat?.name} успешно отправлена!
                </h4>
                <p className="text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
                  Мы получили вашу анкету. Куратор временной передержки внимательно изучит информацию и свяжется с вами по указанному телефону в течение 24 часов.
                </p>
              </div>

              {/* What's next info box */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-left text-xs text-stone-700 space-y-2.5 max-w-md mx-auto">
                <h5 className="font-bold text-stone-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Что произойдёт дальше:
                </h5>
                <ol className="list-decimal list-inside space-y-1 text-stone-600">
                  <li>Куратор позвонит вам для короткой вводной беседы.</li>
                  <li>Мы пригласим вас на временную передержку на очное знакомство с котиком.</li>
                  <li>После взаимной симпатии подписываем согласие на ответственное содержание.</li>
                </ol>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  id="view-my-apps-after-submit-btn"
                  onClick={() => {
                    handleResetAndClose();
                    onViewMyApplications();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Посмотреть статус в «Моих заявках»
                </button>
                <button
                  onClick={handleResetAndClose}
                  className="px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-colors"
                >
                  Вернуться в каталог
                </button>
              </div>
            </div>
          ) : (
            /* Application Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Selected Cat Card preview */}
              {currentCat && (
                <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] sm:grid-cols-[4rem_minmax(0,1fr)_11rem] items-center gap-3 sm:gap-4 p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/70">
                  <img
                    src={currentCat.photos[0]}
                    alt={currentCat.name}
                    style={{ objectPosition: (currentCat.primaryPhotoPosition?.x ?? 50) + '% ' + (currentCat.primaryPhotoPosition?.y ?? 30) + '%' }}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-white shadow-xs"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <h4 className="font-heading font-extrabold text-stone-900 text-base">
                        {currentCat.name}
                      </h4>
                      <span className="text-xs font-bold text-amber-700 whitespace-nowrap">
                        {currentCat.age}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      {currentCat.breed} • {currentCat.color}
                    </p>
                  </div>

                  {allCats.length > 1 && (
                    <label className="col-span-2 sm:col-span-1 min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">Сменить котика</span>
                      <select
                        value={selectedCatId}
                        onChange={(e) => setSelectedCatId(e.target.value)}
                        className="w-full min-w-0 text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-2 font-medium text-stone-700"
                      >
                        {allCats.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}

              {/* Section 1: Contact Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  1. Ваши контактные данные
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Ваше ФИО <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="Иванова Екатерина Сергеевна"
                      className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border ${
                        errors.applicantName
                          ? 'border-rose-400 bg-rose-50/40'
                          : 'border-stone-200 bg-stone-50/50'
                      } focus:bg-white focus:outline-none focus:border-amber-500`}
                    />
                    {errors.applicantName && (
                      <p className="text-rose-500 text-[11px] mt-1">{errors.applicantName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Телефон (WhatsApp/Telegram) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+7 (999) 000-00-00"
                      className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border ${
                        errors.phone
                          ? 'border-rose-400 bg-rose-50/40'
                          : 'border-stone-200 bg-stone-50/50'
                      } focus:bg-white focus:outline-none focus:border-amber-500`}
                    />
                    {errors.phone && (
                      <p className="text-rose-500 text-[11px] mt-1">{errors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Электронная почта <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border ${
                        errors.email
                          ? 'border-rose-400 bg-rose-50/40'
                          : 'border-stone-200 bg-stone-50/50'
                      } focus:bg-white focus:outline-none focus:border-amber-500`}
                    />
                    {errors.email && (
                      <p className="text-rose-500 text-[11px] mt-1">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Город и район проживания <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Санкт-Петербург, м. Площадь Мужества"
                      className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border ${
                        errors.city
                          ? 'border-rose-400 bg-rose-50/40'
                          : 'border-stone-200 bg-stone-50/50'
                      } focus:bg-white focus:outline-none focus:border-amber-500`}
                    />
                    {errors.city && (
                      <p className="text-rose-500 text-[11px] mt-1">{errors.city}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Housing & Safety (Critical for Shelters) */}
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-amber-600" />
                  2. Условия проживания и безопасность
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Тип жилья
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.3fr_0.9fr] gap-2">
                      <label className="flex items-center gap-2 p-2.5 min-h-12 border rounded-xl cursor-pointer hover:bg-stone-50 text-xs">
                        <input
                          type="radio"
                          name="housingType"
                          value="own_apartment"
                          checked={housingType === 'own_apartment'}
                          onChange={() => setHousingType('own_apartment')}
                          className="text-amber-500"
                        />
                        <span className="leading-tight">Собственная квартира</span>
                      </label>
                      <label className="flex items-center gap-2 p-2.5 min-h-12 border rounded-xl cursor-pointer hover:bg-stone-50 text-xs">
                        <input
                          type="radio"
                          name="housingType"
                          value="rented_apartment"
                          checked={housingType === 'rented_apartment'}
                          onChange={() => setHousingType('rented_apartment')}
                          className="text-amber-500"
                        />
                        <span className="leading-tight">Съёмная квартира (с согласия)</span>
                      </label>
                      <label className="flex items-center gap-2 p-2.5 min-h-12 border rounded-xl cursor-pointer hover:bg-stone-50 text-xs">
                        <input
                          type="radio"
                          name="housingType"
                          value="private_house"
                          checked={housingType === 'private_house'}
                          onChange={() => setHousingType('private_house')}
                          className="text-amber-500"
                        />
                        <span>Частный дом</span>
                      </label>
                    </div>
                  </div>

                  {/* Window nets explanation */}
                  <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200/80 text-xs text-blue-950 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-blue-900">
                      <Info className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Безопасность окон (сетки «Антикошка»)</span>
                    </div>
                    <p className="text-blue-900/80 text-[11px] leading-relaxed">
                      Падение из окон и застревание в режиме вертикального проветривания — главная причина гибели домашних кошек в городах. Наличие прочных сеток «Антикошка» или ограничителей — обязательное условие передачи котиков с временной передержки.
                    </p>
                    <div className="flex items-center gap-4 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer font-medium">
                        <input
                          type="radio"
                          name="windowScreens"
                          checked={hasWindowScreens === true}
                          onChange={() => setHasWindowScreens(true)}
                          className="text-blue-600"
                        />
                        <span>Уже установлены / установлю к приезду</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-medium">
                        <input
                          type="radio"
                          name="windowScreens"
                          checked={hasWindowScreens === false}
                          onChange={() => setHasWindowScreens(false)}
                          className="text-blue-600"
                        />
                        <span>Нужна консультация, где заказать</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Pets & Experience */}
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  3. Другие питомцы и опыт
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                    <span className="font-medium text-stone-800">
                      Есть ли у вас сейчас другие домашние животные?
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="hasOtherPets"
                          checked={hasOtherPets === true}
                          onChange={() => setHasOtherPets(true)}
                        />
                        <span>Да</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="hasOtherPets"
                          checked={hasOtherPets === false}
                          onChange={() => setHasOtherPets(false)}
                        />
                        <span>Нет</span>
                      </label>
                    </div>
                  </div>

                  {hasOtherPets && (
                    <input
                      type="text"
                      value={otherPetsDescription}
                      onChange={(e) => setOtherPetsDescription(e.target.value)}
                      placeholder="Укажите, кто именно: возраст, порода, кастрированы ли"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none"
                    />
                  )}

                  <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                    <span className="font-medium text-stone-800">
                      Был ли у вас опыт ухода за кошками ранее?
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="hasExperience"
                          checked={hasExperience === true}
                          onChange={() => setHasExperience(true)}
                        />
                        <span>Да</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="hasExperience"
                          checked={hasExperience === false}
                          onChange={() => setHasExperience(false)}
                        />
                        <span>Первый питомец</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Комментарий, вопросы куратору или пожелания
                    </label>
                    <textarea
                      rows={2}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Расскажите немного о себе, в какое время вам удобнее принять звонок куратора..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Mandatory Agreements */}
              <div className="space-y-2.5 pt-2 border-t border-stone-100 text-xs">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={familyAgreement}
                    onChange={(e) => setFamilyAgreement(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-stone-700 leading-snug">
                    Все проживающие со мной члены семьи согласны на появление котика в доме.
                  </span>
                </label>
                {errors.familyAgreement && (
                  <p className="text-rose-500 text-[11px] pl-6">{errors.familyAgreement}</p>
                )}

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={readyForCare}
                    onChange={(e) => setReadyForCare(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-stone-700 leading-snug">
                    Я готов(а) обеспечить качественное питание, ежегодную вакцинацию и своевременную ветеринарную помощь.
                  </span>
                </label>
                {errors.readyForCare && (
                  <p className="text-rose-500 text-[11px] pl-6">{errors.readyForCare}</p>
                )}
              </div>

              {errors.submit && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                  {errors.submit}
                </p>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2.5 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold transition-colors"
                >
                  Отмена
                </button>
                <button
                  id="submit-adoption-application-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md shadow-amber-500/25 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      <span>Отправка заявки...</span>
                    </>
                  ) : (
                    <>
                      <HeartHandshake className="w-5 h-5" />
                      <span>Отправить заявку на усыновление</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};




