import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { AppComponent as PopupComponent } from './app.component'

@Component({
  selector: 'app-container',
  template: `
    <div>
      <app-root></app-root>
    </div>
  `,
  standalone: true,
  imports: [CommonModule, PopupComponent],
})
export class ContainerComponent {
  constructor() {}
}
