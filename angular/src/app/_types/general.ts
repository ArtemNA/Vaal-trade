export interface ItemProperty {
  id: string; // Унікальний ID з JSON
  key: string; // Ключ (наприклад, "rarity", "level")
  value: string | number | { min?: number; max?: number };
  isImportant: boolean; // Чи вибрав користувач
  originalLine: string;
}

export type ModType = 'explicit' | 'implicit' | 'enchant' | 'rune' | 'sanctum' | 'skill';

export interface Item {

}

export interface ListingItem {
  indexed: string;
  price: {
    type: string;
    amount: number;
    currency: string;
  }
}

export interface ItemResponse {
  id: string;
  item: Item;
  listing: ListingItem;
}

export interface ItemsResponse {
  result: ItemResponse[];
  link?: string;
}
