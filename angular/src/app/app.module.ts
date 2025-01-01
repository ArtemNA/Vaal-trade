import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ItemSelectorComponent } from './components/item-selector/item-selector.component';
import { ItemParserComponent } from './components/item-parser/item-parser.component';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import { TimeFromNowPipe } from './pipes/time-from-now.pipe';
import { ItemCategoryPipe } from './pipes/item-category.pipe';

@NgModule({
  declarations: [
    AppComponent,
    ItemSelectorComponent,
    ItemParserComponent,
    TimeFromNowPipe,
    ItemCategoryPipe
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    CommonModule,
    FormsModule,
    HttpClientModule,
    ReactiveFormsModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
