import { TestBed, waitForAsync } from '@angular/core/testing'
import { AppComponent } from './app.component'
import { CommonModule } from '@angular/common'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations' // Or NoopAnimationsModule

describe('AppComponent', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        AppComponent, // Import the standalone component
        CommonModule,
        MatSlideToggleModule,
        MatFormFieldModule,
        MatInputModule,
        BrowserAnimationsModule, // Or NoopAnimationsModule for tests
      ],
      // No declarations for standalone components
    }).compileComponents()
  }))

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent)
    const app = fixture.componentInstance
    expect(app).toBeTruthy()
  })

  it(`should have as title 'options'`, () => {
    const fixture = TestBed.createComponent(AppComponent)
    const app = fixture.componentInstance
    expect(app.title).toEqual('options')
  })
})
