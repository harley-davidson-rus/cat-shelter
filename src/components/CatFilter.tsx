import React from 'react';
import { Filter, X, Sparkles, Check, Baby, Dog, Users, Smile, Heart, Zap, Coffee, Compass, Search } from 'lucide-react';
import { FilterOptions, AgeCategory, CatGender, CatSize, CatTemperament } from '../types';
import { CAT_STATUS_FILTER_LABELS } from '../utils/catStatus';

interface CatFilterProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  onResetFilters: () => void;
  totalFiltered: number;
  totalCount: number;
}

export const CatFilter: React.FC<CatFilterProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  totalFiltered,
  totalCount,
}) => {
  const isAnyFilterActive =
    filters.search !== '' ||
    filters.gender !== 'all' ||
    filters.ageCategory !== 'all' ||
    filters.size !== 'all' ||
    filters.temperament !== 'all' ||
    filters.goodWithChildren ||
    filters.goodWithCats ||
    filters.goodWithDogs ||
    filters.status !== 'all';

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-stone-200/80 mb-8 space-y-5">
      {/* Top Bar with counter & reset */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-stone-900">
              Подбор компаньона по параметрам
            </h2>
            <p className="text-xs text-stone-500">
              Найдено подопечных: <span className="font-bold text-amber-600">{totalFiltered}</span> из {totalCount}
            </p>
          </div>
        </div>

        {isAnyFilterActive && (
          <button
            id="reset-filters-button"
            onClick={onResetFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Сбросить все фильтры</span>
          </button>
        )}
      </div>

      {/* Main 4 Criteria: Возраст, Пол, Размер, Темперамент */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Пол котика (Gender) */}
        <div>
          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
            Пол
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100 rounded-xl">
            {(['all', 'male', 'female'] as const).map((genderOption) => {
              const labels = {
                all: 'Все',
                male: 'Мальчик',
                female: 'Девочка',
              };
              const isSelected = filters.gender === genderOption;
              return (
                <button
                  key={genderOption}
                  onClick={() => onFilterChange({ ...filters, gender: genderOption })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {labels[genderOption]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Возраст (Age Category) */}
        <div>
          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
            Возраст
          </label>
          <select
            value={filters.ageCategory}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                ageCategory: e.target.value as 'all' | AgeCategory,
              })
            }
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-800 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Любой возраст</option>
            <option value="kitten">Котята (до 1 года)</option>
            <option value="young">Молодые (1–3 года)</option>
            <option value="adult">Взрослые (3–7 лет)</option>
            <option value="senior">Старшие котики (7+ лет)</option>
          </select>
        </div>

        {/* 3. Размер котика (Size) */}
        <div>
          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
            Размер
          </label>
          <select
            value={filters.size}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                size: e.target.value as 'all' | CatSize,
              })
            }
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-800 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Любой размер</option>
            <option value="small">Миниатюрный</option>
            <option value="medium">Средний</option>
            <option value="large">Крупный</option>
          </select>
        </div>

        {/* 4. Темперамент и характер (Temperament) */}
        <div>
          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
            Темперамент
          </label>
          <select
            value={filters.temperament}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                temperament: e.target.value as 'all' | CatTemperament,
              })
            }
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-stone-800 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Любой темперамент</option>
            <option value="cuddly">❤️ Ласковый и ручной</option>
            <option value="playful">⚡ Игривый и активный</option>
            <option value="calm">☕ Спокойный / умиротворяющий</option>
            <option value="independent">👑 Независимый</option>
            <option value="curious">🧭 Любознательный исследователь</option>
          </select>
        </div>
      </div>

      {/* Secondary Quick Toggles: Совместимость и Статус */}
      <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-4">
        {/* Compatibility Quick Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-stone-500 mr-1">Совместимость:</span>

          <button
            onClick={() =>
              onFilterChange({
                ...filters,
                goodWithChildren: !filters.goodWithChildren,
              })
            }
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              filters.goodWithChildren
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Baby className="w-3.5 h-3.5" />
            <span>С детьми</span>
          </button>

          <button
            onClick={() =>
              onFilterChange({
                ...filters,
                goodWithCats: !filters.goodWithCats,
              })
            }
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              filters.goodWithCats
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>С кошками</span>
          </button>

          <button
            onClick={() =>
              onFilterChange({
                ...filters,
                goodWithDogs: !filters.goodWithDogs,
              })
            }
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              filters.goodWithDogs
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Dog className="w-3.5 h-3.5" />
            <span>С собаками</span>
          </button>
        </div>

        {/* Status switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-stone-500">Статус:</span>
          <div className="flex flex-wrap p-1 bg-stone-100 rounded-xl">
            {(['all', 'available', 'reserved', 'trial', 'adopted'] as const).map((statusOption) => {
              const isSelected = filters.status === statusOption;
              return (
                <button
                  key={statusOption}
                  onClick={() => onFilterChange({ ...filters, status: statusOption })}
                  className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {CAT_STATUS_FILTER_LABELS[statusOption]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search sits directly above the results, so changes are visible immediately. */}
      <form
        className="pt-4 border-t border-stone-100"
        onSubmit={(event) => {
          event.preventDefault();
          document.getElementById('cats-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        <label htmlFor="catalog-search-input" className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
          Поиск по анкетам
        </label>
        <div className="relative flex items-center shadow-sm rounded-2xl bg-white border border-stone-200 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-200 transition-all p-1.5">
          <Search className="w-5 h-5 text-stone-400 ml-3 shrink-0" aria-hidden="true" />
          <input
            id="catalog-search-input"
            type="search"
            value={filters.search}
            onChange={(event) => onFilterChange({ ...filters, search: event.target.value })}
            placeholder="Поиск по имени, породе или окрасу (например: Барсик, рыжий)..."
            className="w-full min-w-0 px-3 py-2.5 text-stone-800 placeholder-stone-400 bg-transparent text-sm focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-medium transition-colors shrink-0 cursor-pointer"
          >
            Найти
          </button>
        </div>
      </form>
    </div>
  );
};
