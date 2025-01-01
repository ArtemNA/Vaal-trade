import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'itemCategory',
  standalone: false
})
export class ItemCategoryPipe implements PipeTransform {

  transform(id: string | null | undefined, itemCategories: {id: string, text: string}[], fallbackText?: string): string {
    if (!Array.isArray(itemCategories) || itemCategories.length === 0) {
      return '';
    }

    if (id?.includes('currency') && fallbackText) {
      return fallbackText;
    }

    const foundItem = itemCategories.find(item => item.id === id);
    return foundItem ? foundItem.text : '';
  }
}
