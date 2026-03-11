import { Routes } from '@angular/router';
// Importe o seu componente de login. 
// O caminho exato pode variar dependendo de onde a pasta 'components' está.
import { Login } from './components/login/login'; 

import { TelaInicial } from './components/tela-inicial/tela-inicial';

import { Tanques } from './components/tanques/tanques';

export const routes: Routes = [
  { 
    path: '', // O caminho vazio significa a página inicial (localhost:4200/)
    component: Login 
  },
  { 
    path: 'login', // Se o usuário digitar localhost:4200/login, também vai pra cá
    component: Login 
  },

  {
    path: 'tela-inicial',
    component: TelaInicial // Se o usuário digitar localhost:4200/tela-inicial, também vai pra cá

  },

  {
    path: 'tanques',
    component: Tanques // Se o usuário digitar localhost:4200/tanques, também vai pra cá
  }
];
