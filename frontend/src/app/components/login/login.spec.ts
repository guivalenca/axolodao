import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms'; // 1. Importação necessária para o formulário

import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        Login,
        ReactiveFormsModule // 2. Adicionamos aqui para o HTML reconhecer o [formGroup]
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    
    // 3. O passo mais importante: Força o Angular a renderizar o HTML (login.component.html)
    fixture.detectChanges(); 
    
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});