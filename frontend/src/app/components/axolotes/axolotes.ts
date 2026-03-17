import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Web3Service } from '../../services/web3';

@Component({
  selector: 'app-axolotes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './axolotes.html',
  styleUrls: ['./axolotes.css'] // ou o nome que estiver no seu projeto
})
export class Axolotes implements OnInit {
  
  // --- VARIÁVEIS DE ESTADO ---
  axolotesRegistrados: any[] = [];
  axoloteSelecionadoId: number | null = null;
  axoloteAtual: any = null; // Guarda os dados do axolote clicado
  carregando: boolean = false;
  historicoTanque: any[] = []; // <-- NOVA VARIÁVEL
  carregandoHistorico: boolean = false; // <-- NOVA VARIÁVEL

  constructor(
    private web3Service: Web3Service,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    if (!this.web3Service.address) {
      await this.web3Service.checkConnection();
    }

    if (this.web3Service.contracts?.registry) {
      await this.carregarAxolotes();
    } else {
      setTimeout(() => this.ngOnInit(), 1000);
    }
  }

  // --- BUSCA TODOS OS AXOLOTES NA BLOCKCHAIN (MODO TURBO) ---
  async carregarAxolotes() {
    this.carregando = true;
    try {
      const contract = this.web3Service.contracts.registry;
      if (!contract) return;

      const total = Number(await contract.nextAxolotlId());
      const promessas = [];
      
      // Prepara todas as chamadas
      for (let i = 1; i < total; i++) {
        promessas.push(contract.getAxolotl(i));
      }

      // Dispara tudo em paralelo
      const resultados = await Promise.all(promessas);

      // Limpa e formata os dados
      this.axolotesRegistrados = resultados.filter(ax => ax.active).map(ax => {
        // Converte o Timestamp (segundos) da blockchain para uma Data legível
        const dataNascimento = new Date(Number(ax.birthDate) * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

        return {
          id: Number(ax.id),
          name: ax.name,
          species: ax.species,
          morphData: ax.morphData,
          tankId: Number(ax.tankId),
          birthDate: dataNascimento,
          // Foto estática por enquanto
          img: 'assets/axolotes-loginPage.png' 
        };
      });

      // Se achou algum axolote, já seleciona o primeiro para não deixar a tela vazia
      if (this.axolotesRegistrados.length > 0) {
        this.selecionarAxolote(this.axolotesRegistrados[0].id);
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error("Erro ao carregar axolotes:", error);
    } finally {
      this.carregando = false;
    }
  }

  // --- AÇÃO AO CLICAR NO BOTÃO DO FILTRO ---
  selecionarAxolote(id: number) {
    this.axoloteSelecionadoId = id;
    this.axoloteAtual = this.axolotesRegistrados.find(ax => ax.id === id);
    
    // Assim que escolhe o axolote, busca o histórico do tanque dele!
    if (this.axoloteAtual) {
      this.carregarHistoricoDoTanque(this.axoloteAtual.tankId);
    }
  }

  async carregarHistoricoDoTanque(tankId: number) {
    this.carregandoHistorico = true;
    this.historicoTanque = []; // Limpa o histórico anterior

    try {
      const monContract = this.web3Service.contracts.monitoring;
      if (!monContract) return;

      const total = Number(await monContract.nextMeasurementId());
      const tempHistorico: any[] = [];
      let contador = 0;

      // Loop de trás pra frente para pegar as mais recentes (limite de 4 para caber na tela)
      for (let i = total - 1; i >= 1; i--) {
        const m = await monContract.getMeasurement(i);

        if (Number(m.tankId) === tankId) {
          
          // Mapeia o status do contrato para o visual do seu Figma
          let statusTexto = 'Pendente';
          let statusClasse = 'badge-orange'; // Amarelinho
          
          if (Number(m.status) === 1) { 
            statusTexto = 'Aceito'; 
            statusClasse = 'badge-green'; 
          } else if (Number(m.status) === 2) { 
            statusTexto = 'Recusado'; 
            statusClasse = 'badge-red'; 
          }

          tempHistorico.push({
            tipo: 'Medição de Água',
            temperatura: (Number(m.temperature) / 100).toFixed(1),
            ph: (Number(m.ph) / 100).toFixed(1),
            statusTexto: statusTexto,
            statusClasse: statusClasse
          });

          contador++;
          if (contador >= 4) break; // Pega no máximo as 4 últimas medições
        }
      }

      this.historicoTanque = tempHistorico;

    } catch (error) {
      console.error("Erro ao carregar histórico do tanque:", error);
    } finally {
      this.carregandoHistorico = false;
      this.cdr.detectChanges();
    }
  }
}