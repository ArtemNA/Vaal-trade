import {Component} from '@angular/core';
import {ApiService} from '../../services/api.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ItemResponse, ListingCurrency, ListingCurrencyOffer} from '../../_types/general';

@Component({
  selector: 'app-item-selector',
  templateUrl: './item-selector.component.html',
  styleUrl: './item-selector.component.scss',
  standalone: false
})
export class ItemSelectorComponent {
  clipboardContent: string = '';
  items!: ItemResponse[] | { id: string; listing: ListingCurrency }[];
  link?: string;
  type: 'currency' | 'other' = "other";


  constructor(private apiService: ApiService) {
    this.apiService.itemsFromSearch$.pipe(takeUntilDestroyed()).subscribe(res => {
      if (res) {
        this.type = 'other';
      }
      this.items = res?.result;
      this.link = res?.link || undefined;
    })
    this.apiService.currencyFromSearch$.pipe(takeUntilDestroyed()).subscribe(res => {
      if (res) {
        this.type = 'currency';
      }
      this.items = res?.result;
      this.link = res?.link || undefined;
    })
  }

  async getItem() {
    const data = await navigator.clipboard.readText();
    this.clipboardContent = data;
  }

  openInBrowser() {
    this.apiService.openInBrowser(this.link!);
  }

  isItemResponse(obj: ItemResponse[] | { id: string; listing: ListingCurrency }[]): obj is ItemResponse[] {
    return this.type === 'other';
  }

  getItemExchangeDetails(item: { id: string; listing: ListingCurrency }): ListingCurrencyOffer {
    return item.listing.offers[0];
  }
}
