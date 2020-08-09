import { BrowserModule } from '@angular/platform-browser'
import { NgModule } from '@angular/core'

import { AppComponent } from './app.component'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { ReactiveFormsModule } from '@angular/forms'
import { MatListModule } from '@angular/material/list';
import { MatInputAutofocusDirective } from './mat-input-autofocus.directive'

@NgModule({
  declarations: [AppComponent, MatInputAutofocusDirective],
  imports: [BrowserModule, BrowserAnimationsModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, MatListModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
