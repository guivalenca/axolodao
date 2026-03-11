import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Tanques } from '../tanques/tanques'; // <-- Ajuste o caminho '../' se a pasta tanques estiver em outro lugar
import { Axolotes } from '../axolotes/axolotes'; // <-- Ajuste o caminho '../' se a pasta axolotes estiver em outro lugar


@Component({
  selector: 'app-tela-inicial',
  standalone: true,
  imports: [CommonModule, Tanques, Axolotes],
  templateUrl: './tela-inicial.html',
  styleUrls: ['./tela-inicial.css']
})
export class TelaInicial implements OnInit, OnDestroy {
  // --- NAVEGAÇÃO DO MENU LATERAL ---
  menuAtivoLateral: string = 'home';

  navegarMenuLateral(menu: string, event: Event) {
    event.preventDefault(); 
    this.menuAtivoLateral = menu;
  }

  // --- LÓGICA DAS TABS DA HOME ---
  abaAtiva: string = 'ultimo_acesso';

  selecionarAba(aba: string) {
    this.abaAtiva = aba;
  }

  // --- LÓGICA DO CARROSSEL ESTILO DISNEY+ ---
  slideAtual = 0;
  intervaloCarrossel: any;

  itensCarrossel = [
    { titulo: 'Axolote Rosa', desc: 'Último registro às 14:00', imagem: '/assets/axolotes-loginPage.png' },
    { titulo: 'Tanque Principal', desc: 'Temperatura normal', imagem: '/assets/axolotes-loginPage.png' },
    { titulo: 'Axolote Dourado', desc: 'Alimentado recentemente', imagem: '/assets/axolotes-loginPage.png' }
  ];

  ngOnInit() {
    this.iniciarCarrossel();
  }

  ngOnDestroy() {
    this.pararCarrossel(); 
  }

  iniciarCarrossel() {
    this.intervaloCarrossel = setInterval(() => {
      this.proximoSlide();
    }, 4000); 
  }

  pararCarrossel() {
    if (this.intervaloCarrossel) clearInterval(this.intervaloCarrossel);
  }

  proximoSlide() {
    this.slideAtual = (this.slideAtual + 1) % this.itensCarrossel.length;
  }

  slideAnterior() {
    if (this.slideAtual === 0) {
      this.slideAtual = this.itensCarrossel.length - 1;
    } else {
      this.slideAtual--;
    }
  }

  irParaSlide(index: number) {
    this.slideAtual = index;
    this.pararCarrossel();
    this.iniciarCarrossel();
  }
}