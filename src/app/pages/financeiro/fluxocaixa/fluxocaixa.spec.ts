import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FluxoCaixaComponent } from './fluxocaixa.component';

describe('Fluxocaixa', () => {
  let component: FluxoCaixaComponent;
  let fixture: ComponentFixture<FluxoCaixaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FluxoCaixaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FluxoCaixaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
