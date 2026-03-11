import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // Importante para o *ngIf e [formGroup] funcionarem
  templateUrl: './login.html', // ou login.component.html, dependendo do nome do seu arquivo
  styleUrls: ['./login.css']   // ou login.component.css
})
export class Login {
  // 1. Aqui está a variável que estava faltando para resolver o seu erro!
  errorMessage: string = '';

  // 2. Declarando o formulário e suas regras de validação (para o formControlName)
  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)])
  });

  // 3. A função que é chamada quando você clica em "Entrar" (ngSubmit)
  onSubmit() {
    if (this.loginForm.valid) {
      // Lógica de login com sucesso (ex: enviar para a API)
      console.log('Dados do login:', this.loginForm.value);
      this.errorMessage = ''; // Limpa a mensagem de erro
    } else {
      // Se o formulário for inválido
      this.errorMessage = 'E-mail ou senha incorretos.';
    }
  }
}