import { Component, ChangeDetectionStrategy } from '@angular/core'

import { AppComponent as PopupComponent } from './app.component'

@Component({
  selector: 'app-container',
  template: `
    <div>
      <app-root></app-root>
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [PopupComponent],
})
export class ContainerComponent {
  constructor() {}
}
