import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {Observable, forkJoin, of, tap} from 'rxjs';

@Injectable({ providedIn: 'root' })
export class JsonDataService {
  private basePath = 'assets/jsons/';
  private localCache: any | null = null;

  constructor(private http: HttpClient) {}

  loadJsonData(): Observable<any> {
    if (this.localCache) {
      return of(this.localCache);
    }
    return forkJoin({
      filters: this.http.get(`${this.basePath}filters.json`),
      items: this.http.get(`${this.basePath}items.json`),
      stats: this.http.get(`${this.basePath}stats.json`),
      data: this.http.get(`${this.basePath}data.json`)
    }).pipe(
      tap((data) => {
        this.localCache = data;
      })
    );
  }
}
