import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tanques',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tanques.html',
  styleUrls: ['./tanques.css']
})
export class Tanques {
  // Lista fictícia para a barra lateral verde
  axolotes = [
    { nome: 'Axolote', img: '/assets/axolotes-loginPage.png' },
    { nome: 'Axolote', img: '/assets/axolotes-loginPage.png' },
    { nome: 'Axolote', img: '/assets/axolotes-loginPage.png' },
    { nome: 'Axolote', img: '/assets/axolotes-loginPage.png' }
  ];
}