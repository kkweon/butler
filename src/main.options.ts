import { enableProdMode, importProvidersFrom } from '@angular/core'
import { bootstrapApplication, BrowserModule } from '@angular/platform-browser'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'

import { OptionsComponent } from './app/options.component'
import { environment } from './environments/environment'

if (environment.production) {
  enableProdMode()
}

bootstrapApplication(OptionsComponent, {
  providers: [
    importProvidersFrom(
      BrowserModule,
      BrowserAnimationsModule,
      MatFormFieldModule,
      MatInputModule,
      MatSlideToggleModule,
    ),
    // No router needed for options page currently
  ],
}).catch((err) => console.error(err))
