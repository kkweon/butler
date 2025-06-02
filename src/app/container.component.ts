import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute } from '@angular/router'
import { AppComponent as PopupComponent } from './app.component'
import { OptionsComponent } from './options.component'

@Component({
  selector: 'app-container',
  template: `
    <div>
      <app-root *ngIf="!isOptionsView"></app-root>
      <app-options *ngIf="isOptionsView"></app-options>
    </div>
  `,
  standalone: true,
  imports: [CommonModule, PopupComponent, OptionsComponent],
})
export class ContainerComponent implements OnInit {
  isOptionsView = false

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Check if we're on the options page by URL or query parameter
    const currentUrl = window.location.href
    const isOptionsPage = currentUrl.includes('options.html')

    this.route.queryParams.subscribe((params) => {
      this.isOptionsView = isOptionsPage || params['view'] === 'options'
    })
  }
}
