import { enableProdMode, importProvidersFrom } from '@angular/core'
import { bootstrapApplication, BrowserModule } from '@angular/platform-browser'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'

import { AppComponent } from './app/app.component'
import { environment } from './environments/environment'

import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'

if (environment.production) {
  enableProdMode()
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserModule,
      BrowserAnimationsModule,
      MatSlideToggleModule,
      MatFormFieldModule,
      MatInputModule,
    ),
  ],
}).catch((err) => console.error(err))
