import {Component} from '@angular/core';
import {ApiService} from '../../services/api.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ItemResponse} from '../../_types/general';

@Component({
  selector: 'app-item-selector',
  templateUrl: './item-selector.component.html',
  styleUrl: './item-selector.component.scss',
  standalone: false
})
export class ItemSelectorComponent {
  clipboardContent: string = '';
  items!: ItemResponse[];
  link?: string;


  constructor(private apiService: ApiService) {
    this.apiService.itemsFromSearch$.pipe(takeUntilDestroyed()).subscribe(res => {
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
}
