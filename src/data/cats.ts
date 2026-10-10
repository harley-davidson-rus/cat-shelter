import { Cat } from '../types';
import realCatPhoto from '../assets/defaultCat';

export const INITIAL_CATS: Cat[] = [
  {
    id: 'cat-1',
    name: 'Подопечный передержки',
    age: '1-2 года',
    ageCategory: 'adult',
    gender: 'male',
    size: 'medium',
    weightKg: 4.2,
    temperament: 'calm',
    color: 'Белый с тёмными отметинами',
    breed: 'Метис',
    photos: [realCatPhoto],
    videos: [],
    character: ['Спокойный', 'Ласковый', 'Ориентирован на человека'],
    story: 'Наш подопечный попал в передержку и с нетерпением ждёт своего ответственного человека и тёплый дом.',
    habits: {
      litterBox: 'Приучен к лотку',
      scratchingPost: 'Приучен к когтеточке',
      foodPreference: 'Качественный сбалансированный корм'
    },
    health: {
      vaccinated: true,
      sterilized: true,
      parasiteTreated: true,
      fivFelvNegative: true
    },
    goodWith: {
      children: true,
      otherCats: true,
      dogs: true
    },
    arrivalDate: '2026',
    status: 'available',
    featured: true
  }
];

export const SHELTER_INFO = {
  name: 'АНО\u00A0«Фонд помощи животным «Доброта\u00A0для\u00A0кота»»',
  tagline: 'Дарим пушистым сердцам второй шанс найти любящий дом',
  stats: {
    adoptedCount: 384,
    currentCount: 51,
    volunteersCount: 45,
    healthyPercentage: 100
  },
  address: 'Санкт-Петербург, м. Площадь Мужества',
  visitingHours: 'Любой день по предварительной договорённости.',
  phone: '',
  telegram: 't.me/maythecatbewithyou',
  telegramUrl: 'https://t.me/maythecatbewithyou',
  maxUrl: 'https://max.ru/channel_dobrotadylakota',
  vkUrl: 'https://vk.ru/dobrota_dlya_kota',
  youtubeUrl: 'https://www.youtube.com/@dobrota_d_kota'
};



