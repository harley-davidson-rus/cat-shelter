import React from 'react';
import { Heart, Sparkles, Shield, Users, CheckCircle2, MapPin, Clock } from 'lucide-react';
import { SiteContacts } from '../types';
import shelterAboutImageTop from '../assets/images/regenerated_image_1790020540460.jpg';
import shelterAboutImageBottom from '../assets/images/regenerated_image_1790020539576.jpg';

export const ShelterAboutSection: React.FC<{ contacts: SiteContacts }> = ({ contacts }) => {
  return (
    <section id="about" className="py-16 sm:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Photos Collage */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="rounded-3xl overflow-hidden shadow-md aspect-3/4">
                <img
                  src={shelterAboutImageTop}
                  alt="Котики на временной передержке"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/60 text-xs">
                <span className="font-bold text-amber-900 block mb-1">Безклеточное содержание</span>
                <p className="text-stone-600 leading-relaxed">
                  Наши котики живут в&nbsp;просторном светлом игровом помещении с&nbsp;кошачьими городками, полочками и&nbsp;уютными лежанками.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-8">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/60 text-xs">
                <span className="font-bold text-emerald-900 block mb-1">Карантин и ветконтроль</span>
                <p className="text-stone-600 leading-relaxed">
                  Каждый поступивший к&nbsp;нам пушистик проходит диагностику, если есть показания&nbsp;&mdash; выдерживает карантин. Все животные в&nbsp;нашей передержке своевременно вакцинируются.
                </p>
              </div>
              <div className="rounded-3xl overflow-hidden shadow-md aspect-3/4">
                <img
                  src={shelterAboutImageBottom}
                  alt="Котик на временной передержке"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>

          {/* Text Story */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span>О фонде <span className="whitespace-nowrap">«Доброта&nbsp;для&nbsp;кота»</span></span>
            </div>

            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight leading-tight">
              Мы верим, что у&nbsp;каждого котика должен быть тёплый и&nbsp;безопасный дом
            </h2>

            <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
              Фонд помощи животным <span className="whitespace-nowrap">«Доброта&nbsp;для&nbsp;кота»</span> был создан волонтёрами, неравнодушными к&nbsp;судьбам котиков, оказавшихся в&nbsp;трудной ситуации. Мы спасаем котиков, которые живут в&nbsp;сложных условиях, родились на&nbsp;улице или потеряли хозяев.
            </p>

            {/* Checklist of Principles */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">
                    100% ветеринарный контроль и стерилизация
                  </h4>
                  <p className="text-xs text-stone-500">
                    Все котики в&nbsp;нашей временной передержке кастрированы, вакцинированы, обработаны от&nbsp;паразитов и&nbsp;проходят ежедневный ветеринарный контроль.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">
                    Социализация и зоопсихология
                  </h4>
                  <p className="text-xs text-stone-500">
                    С&nbsp;котиками постоянно общаются волонтёры, приучая к&nbsp;рукам, вычёсыванию, играм и&nbsp;доверию к&nbsp;человеку.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">
                    Пожизненная поддержка выпускников
                  </h4>
                  <p className="text-xs text-stone-500">
                    Наши кураторы остаются на связи даже спустя годы, помогая советами по уходу, здоровью и питанию.
                  </p>
                </div>
              </div>
            </div>

            {/* Address & Hours Preview */}
            <div className="pt-4 flex flex-wrap gap-4 text-xs text-stone-600 border-t border-stone-100">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{contacts.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{contacts.visitingHours}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};





