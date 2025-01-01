export interface ItemProperty {
  id: string;
  key: string;
  value: string | number;
  isImportant: boolean;
  originalLine: string;
  min?: number;
  max?: number;
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

export interface ListingCurrencyOffer {
  exchange: {
    currency: string,
    amount: number,
  },
  item: {
    amount: number,
    stock: number,
    id: string,
    currency: string,
  }
}

export interface ListingCurrency {
  indexed: string;
  offers: [ListingCurrencyOffer]
}

export interface CurrencyResponse {
  result: {
    id: string;
    listing: ListingCurrency;
  }[];
  link?: string;
}
