import { TestBed, waitForAsync } from '@angular/core/testing'
import { AppComponent } from './app.component'
import { MatFormFieldModule } from '@angular/material/form-field'

describe('AppComponent', () => {
  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        imports: [MatFormFieldModule],
        declarations: [AppComponent],
      }).compileComponents()
    }),
  )

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent)
    const app = fixture.componentInstance
    expect(app).toBeTruthy()
  })

  it(`should have as title 'butler'`, () => {
    const fixture = TestBed.createComponent(AppComponent)
    const app = fixture.componentInstance
    expect(app.title).toEqual('butler')
  })
})
