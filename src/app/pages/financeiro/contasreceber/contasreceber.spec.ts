import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Contasreceber } from './contasreceber.component';

describe('Contasreceber', () => {
  let component: Contasreceber;
  let fixture: ComponentFixture<Contasreceber>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Contasreceber]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Contasreceber);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
