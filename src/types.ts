export type AgeCategory = 'kitten' | 'young' | 'adult' | 'senior';
export type CatGender = 'male' | 'female';
export type CatStatus = 'available' | 'reserved' | 'trial' | 'adopted';
export type CatSize = 'small' | 'medium' | 'large';
export type CatTemperament = 'cuddly' | 'playful' | 'calm' | 'independent' | 'curious';

export interface CatHealth {
  vaccinated: boolean;
  sterilized: boolean;
  parasiteTreated: boolean;
  fivFelvNegative: boolean;
  specialNeeds?: string;
}

export interface GoodWith {
  children: boolean;
  otherCats: boolean;
  dogs: boolean;
}

export interface CatVideo {
  id: string;
  url: string;
  title: string;
  duration?: string;
  thumbnail?: string;
  isShort?: boolean;
}

export interface Cat {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  name: string;
  age: string;
  ageCategory: AgeCategory;
  gender: CatGender;
  size: CatSize;
  weightKg?: number;
  temperament: CatTemperament;
  color: string;
  breed: string;
  photos: string[];
  primaryPhotoPosition?: {
    x: number;
    y: number;
  };
  videos: CatVideo[];
  character: string[];
  story: string;
  habits: {
    litterBox: string;
    scratchingPost: string;
    foodPreference: string;
  };
  health: CatHealth;
  goodWith: GoodWith;
  arrivalDate: string;
  status: CatStatus;
  featured?: boolean;
}

export interface ShelterStats {
  adoptedCount: number;
  currentCount: number;
}

export interface SiteContacts {
  address: string;
  visitingHours: string;
  phone: string;
  telegram: string;
  telegramUrl: string;
  maxUrl: string;
  vkUrl: string;
  youtubeUrl: string;
  rutubeUrl: string;
}

export interface DonationSettings {
  title: string;
  description: string;
  image: string;
}

export interface DatabaseBackupSettings {
  time: string;
  retentionCount: number;
  directory: string;
}

export type HousingType = 'own_apartment' | 'rented_apartment' | 'private_house';

export type ApplicationStatus = 'new' | 'reviewing' | 'meeting_scheduled' | 'approved' | 'rejected';

export interface AdoptionApplication {
  id: string;
  catId: string;
  catName: string;
  catPhoto?: string;
  applicantName: string;
  phone: string;
  email: string;
  city: string;
  housingType: HousingType;
  hasWindowScreens: boolean;
  hasOtherPets: boolean;
  otherPetsDescription?: string;
  hasExperience: boolean;
  experienceDescription?: string;
  familyAgreement: boolean;
  comment?: string;
  status: ApplicationStatus;
  createdAt: string;
  adminNotes?: string;
}

export interface FilterOptions {
  search: string;
  gender: 'all' | CatGender;
  ageCategory: 'all' | AgeCategory;
  size: 'all' | CatSize;
  temperament: 'all' | CatTemperament;
  goodWithChildren: boolean;
  goodWithCats: boolean;
  goodWithDogs: boolean;
  vaccinatedOnly: boolean;
  sterilizedOnly: boolean;
  status: 'all' | 'available' | 'reserved' | 'trial';
}

export type ArticleCategory = 'rescue_story' | 'shelter_success' | 'resources' | 'event';

export interface ShelterArticle {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  title: string;
  category: ArticleCategory;
  summary: string;
  content: string;
  coverImage: string;
  coverPosition?: { x: number; y: number };
  galleryImages?: string[];
  videos?: CatVideo[];
  publishedAt: string;
  readTimeMinutes: number;
  author: string;
  authorRole?: string;
  eventDate?: string;
  eventLocation?: string;
  relatedCatId?: string;
  tags: string[];
  likesCount?: number;
}





