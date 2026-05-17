import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnvasesComponent } from './envases.component';

describe('EnvasesComponent', () => {
  let component: EnvasesComponent;
  let fixture: ComponentFixture<EnvasesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnvasesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EnvasesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
