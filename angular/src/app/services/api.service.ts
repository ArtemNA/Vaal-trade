// @ts-nocheck
import { Injectable } from '@angular/core';
import {Subject} from 'rxjs';
import {ItemsResponse} from '../_types/general';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  public itemFromClipboard$ = new Subject<any>();
  public itemsFromSearch$ = new Subject<ItemsResponse>();

  constructor() {
    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', (event: MessageEvent) => {
        console.log('Message from .NET:', event.data);
        if (event.data?.action === 'loadItemFromClipboard') {
          this.itemFromClipboard$.next(event.data.payload);
          this.itemsFromSearch$.next(null);
        }
        if (event.data?.action === 'tradeSearchResponse') {
          const data = typeof event.data.payload === 'string' ? JSON.parse(event.data.payload) : event.data.payload;
          this.itemsFromSearch$.next({...data, link: event.data.link});
        }
      });
    }
  }

  searchItem(query: any): Promise<ItemsResponse> {
    return new Promise((resolve, reject) => {
      if (window.chrome?.webview?.postMessage) {
        this.sendMessage({ action: 'sendPayload', payload: query });
      } else {
        reject('WebView2 communication not available');
      }
    });
  }

  openInBrowser(link: string): Promise<void> {
    if ((window as any).chrome?.webview?.postMessage) {
      this.sendMessage({ action: 'openInBrowser', payload: link })
    } else {
      console.error('WebView2 API is not available');
    }
  }

  sendMessage(message: any) {
    try {
      if (window.chrome?.webview) {
        const jsonString = JSON.stringify(message);
        console.log("Sending message to WebView2:", jsonString);
        window.chrome.webview.postMessage(jsonString);
      } else {
        console.error("WebView2 is not available.");
      }
    } catch (error) {
      console.error("Error sending message to WebView2:", error);
    }
  }
}


