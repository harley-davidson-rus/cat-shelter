import React, { useState } from 'react';
import { FileCheck, PhoneCall, HeartHandshake, Home, ChevronDown, ChevronUp, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

export const AdoptionRulesSection: React.FC<{ onStartAdoptionClick: () => void }> = ({
  onStartAdoptionClick,
}) => {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const steps = [
    {
      number: '01',
      icon: FileCheck,
      title: 'Выберите подопечного и заполните анкету',
      description:
        'Изучите карточки котиков на сайте и отправьте онлайн-заявку. В анкете расскажите об условиях проживания и вашем опыте.',
    },
    {
      number: '02',
      icon: PhoneCall,
      title: 'Беседа с куратором временной передержки',
      description:
        'Куратор свяжется с вами по телефону или мессенджеру, ответит на любые вопросы по здоровью и привычкам котика.',
    },
    {
      number: '03',
      icon: HeartHandshake,
      title: 'Личное знакомство на временной передержке',
      description:
        'Приезжайте к нам в гости! Вы сможете погладить котика, поиграть с ним и почувствовать, случилась ли та самая искра.',
    },
    {
      number: '04',
      icon: Home,
      title: 'Подписание согласия и переезд',
      description:
        'Котики передаются бесплатно после подписания согласия на ответственное содержание. Мы остаемся на связи и помогаем советами по адаптации.',
    },
  ];

  const faqs = [
    {
      q: 'Сколько стоит взять котика с временной передержки?',
      a: 'Все наши котики передаются абсолютно бесплатно. Наша цель — найти каждому животному ответственный и надёжный дом. Вы всегда можете по желанию поддержать временную передержку кормом или пожертвованием, но это не является условием усыновления.',
    },
    {
      q: 'Почему временная передержка требует сетки «Антикошка» на окнах?',
      a: 'Обычные москитные сетки крепятся на хлипких пластиковых уголках и не выдерживают вес прыгнувшей за птицей кошки. Сетки «Антикошка» изготавливаются из усиленного полотна и надёжно фиксируются металлическим крепёжом. Это залог того, что питомец не разобьётся при проветривании.',
    },
    {
      q: 'Что нужно подготовить к приезду нового члена семьи?',
      a: 'Перед приездом котика вам понадобятся: надёжная пластиковая переноска (забирать только в ней, на руках везти нельзя!), просторный лоток, привычный наполнитель, миски для еды и воды, когтеточка и запас корма, рекомендованного куратором.',
    },
    {
      q: 'А что делать, если котик не уживется с другими питомцами?',
      a: 'Мы всегда на связи и даём подробные рекомендации по поэтапному знакомству животных. Но если по непредвиденным обстоятельствам совместная жизнь не сложится — временная передержка безоговорочно и в любое время примет своего подопечного обратно.',
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-stone-100/70 border-y border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div id="rules" className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Прозрачный и бережный процесс</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            Как взять котика домой — 4 простых шага
          </h2>
          <p className="text-sm sm:text-base text-stone-600">
            Мы заботимся о благополучии каждого хвостатого подопечного и делаем путь в семью понятным и безопасным.
          </p>
        </div>

        {/* 4 Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-3xl p-6 border border-stone-200/80 shadow-xs relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-xs">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="font-heading font-black text-2xl text-stone-200">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="font-heading font-extrabold text-stone-900 text-base mb-2">
                    {step.title}
                  </h3>

                  <p className="text-xs text-stone-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ Accordion and Guarantee banner */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* FAQ Column */}
          <div className="lg:col-span-7 space-y-3">
            <h3 className="font-heading text-2xl font-bold text-stone-900 mb-4">
              Часто задаваемые вопросы
            </h3>

            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-stone-200 overflow-hidden transition-colors"
                  >
                    <button
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-heading font-bold text-sm sm:text-base text-stone-900 hover:text-amber-600 transition-colors"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-stone-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-stone-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-xs sm:text-sm text-stone-600 leading-relaxed border-t border-stone-100 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Guarantee Card */}
          <div className="lg:col-span-5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>

            <h3 className="font-heading text-2xl font-extrabold leading-tight">
              Согласие на ответственное содержание
            </h3>

            <p className="text-sm text-white/90 leading-relaxed">
              Мы не бросаем наших подопечных после усыновления. Временная передержка гарантирует бесплатную информационную и ветеринарную консультацию и помощь в адаптации на протяжении всей жизни питомца.
            </p>

            <div className="space-y-2 text-xs text-white/90">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-200" />
                <span>Испытательный срок — 1 месяц</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-200" />
                <span>Всесторонняя консультация</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-200" />
                <span>Безопасная адаптация к новому дому</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onStartAdoptionClick}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-stone-50 text-stone-900 font-bold text-xs sm:text-sm shadow-md transition-all text-center"
              >
                Подать онлайн-заявку на котика
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};


