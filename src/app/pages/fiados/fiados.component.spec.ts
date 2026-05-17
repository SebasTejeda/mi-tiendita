import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FiadosComponent } from './fiados.component';

describe('FiadosComponent', () => {
  let component: FiadosComponent;
  let fixture: ComponentFixture<FiadosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FiadosComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FiadosComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
