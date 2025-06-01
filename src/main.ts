import { enableProdMode, importProvidersFrom } from '@angular/core'
import { bootstrapApplication, BrowserModule } from '@angular/platform-browser'

import { AppComponent } from './app/app.component'
import { environment } from './environments/environment'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatListModule } from '@angular/material/list'
import { ReactiveFormsModule } from '@angular/forms'
import { ChromeSharedOptionsModule } from 'chrome-shared-options'
import { MatIconModule } from '@angular/material/icon'

if (environment.production) {
  enableProdMode()
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserModule,
      BrowserAnimationsModule,
      MatFormFieldModule,
      MatInputModule,
      ReactiveFormsModule,
      MatListModule,
      ChromeSharedOptionsModule,
      MatIconModule,
    ),
  ],
}).catch((err) => console.error(err))
