import React from 'react';
import { X, Heart, ArrowRight, Trash2 } from 'lucide-react';
import { Cat } from '../types';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  favoriteCats: Cat[];
  onRemoveFavorite: (id: string) => void;
  onSelectCat: (cat: Cat) => void;
  onApplyForAdoption: (cat: Cat) => void;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({
  isOpen,
  onClose,
  favoriteCats,
  onRemoveFavorite,
  onSelectCat,
  onApplyForAdoption,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200" onClick={onClose}>
      <div
        id="favorites-modal-container"
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h3 className="font-heading text-base sm:text-lg leading-tight font-bold text-stone-900">
                Избранные подопечные
              </h3>
              <p className="text-xs text-stone-500">
                Сохранённые анкеты котиков ({favoriteCats.length})
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

        {/* Content */}
        <div className="overflow-y-auto p-3 sm:p-6 space-y-4">
          {favoriteCats.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                <Heart className="w-8 h-8" />
              </div>
              <h4 className="font-heading font-bold text-lg text-stone-800">
                Список избранного пуст
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Нажимайте на значок сердечка на карточках котиков, чтобы сохранить их анкеты и вернуться к ним позже.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {favoriteCats.map((cat) => (
                <div
                  key={cat.id}
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4 rounded-2xl border border-stone-200 hover:border-amber-300 transition-all bg-white"
                >
                  <div
                    className="flex min-w-0 w-full items-center gap-3 cursor-pointer sm:flex-1 sm:gap-3.5"
                    onClick={() => {
                      onClose();
                      onSelectCat(cat);
                    }}
                  >
                    <img
                      src={cat.photos[0]}
                      alt={cat.name}
                      style={{ objectPosition: (cat.primaryPhotoPosition?.x ?? 50) + '% ' + (cat.primaryPhotoPosition?.y ?? 30) + '%' }}
                      className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <h4 className="font-heading font-extrabold text-stone-900 text-base hover:text-amber-600 transition-colors">
                          {cat.name}
                        </h4>
                        <span className="text-xs font-bold text-amber-600">
                          {cat.age}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">
                        {cat.breed} • {cat.gender === 'male' ? 'Мальчик' : 'Девочка'}
                      </p>
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:shrink-0">
                    <button
                      onClick={() => onRemoveFavorite(cat.id)}
                      className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Удалить из избранного"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {cat.status === 'available' && (
                      <button
                        onClick={() => {
                          onClose();
                          onApplyForAdoption(cat);
                        }}
                        className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-amber-600 sm:flex-none"
                      >
                        <span>Подать заявку</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


