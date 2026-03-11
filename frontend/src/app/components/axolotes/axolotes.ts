import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-axolotes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './axolotes.html',
  styleUrls: ['./axolotes.css']
})
export class Axolotes {
  // Lista fictícia para a barra lateral de comentários
  comentarios = [
    { titulo: 'Comentário', texto: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.' },
    { titulo: 'Comentário', texto: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.' },
    { titulo: 'Comentário', texto: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.' }
  ];
}