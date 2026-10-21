import type { CatGender, CatStatus } from '../types';

export const getCatStatusLabel = (status: CatStatus, gender: CatGender): string => {
  switch (status) {
    case 'available':
      return 'Ищет дом';
    case 'reserved':
      return 'На\u00a0бронировании';
    case 'trial':
      return 'На\u00a0испытательном сроке';
    case 'adopted':
      return gender === 'female' ? 'Нашла дом' : 'Нашёл дом';
  }
};

export const CAT_STATUS_FILTER_LABELS: Record<'all' | CatStatus, string> = {
  all: 'Все',
  available: 'Ищут дом',
  reserved: 'На\u00a0бронировании',
  trial: 'На\u00a0испытательном сроке',
  adopted: 'Нашли дом',
};
