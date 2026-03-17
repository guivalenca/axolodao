import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Tanques } from '../tanques/tanques';
import { Axolotes } from '../axolotes/axolotes';
import { Web3Service } from '../../services/web3';
import { Monitoramento } from '../monitoramento/monitoramento';
import { CadastroAxolote } from '../cadastro-axolote/cadastro-axolote';
import { CadastroTanque } from '../cadastro-tanque/cadastro-tanque';

@Component({
  selector: 'app-tela-inicial',
  standalone: true,
  imports: [CommonModule, Tanques, Axolotes, Monitoramento, CadastroAxolote, CadastroTanque],
  templateUrl: './tela-inicial.html',
  styleUrls: ['./tela-inicial.css'],
})
export class TelaInicial implements OnInit, OnDestroy {
  // === VARIÁVEL DE CONTROLE DE ACESSO (RBAC) ===
  cargoUsuario: 'operador' | 'auditor' | 'nenhum' = 'nenhum';

  

  // --- NAVEGAÇÃO DO MENU LATERAL ---
  menuAtivoLateral: string = 'home';
  tituloPagina: string = 'Home';
  subtituloPagina: string = 'Bem-vindo ao painel de gestão';

  // --- LÓGICA DAS TABs/PÍLULAS DA HOME ---
  abaAtiva: string = 'ultimo_acesso';

  // --- LÓGICA DO CARROSSEL ESTILO DISNEY+ ---
  slideAtual = 0;
  intervaloCarrossel: any;

  itensCarrossel = [
    { titulo: 'Axolote Rosa', desc: 'Último registro às 14:00', imagem: '/assets/axolotes-loginPage.png' },
    { titulo: 'Tanque Principal', desc: 'Temperatura normal', imagem: '/assets/axolotes-loginPage.png' },
    { titulo: 'Axolote Dourado', desc: 'Alimentado recentemente', imagem: '/assets/axolotes-loginPage.png' },
  ];

  // --- VARIÁVEIS DE DADOS DA BLOCKCHAIN (Operador) ---
  tanquesRegistrados: any[] = [];
  axolotesRegistrados: any[] = [];
  ultimosAcessos: any[] = []; 
  carregandoTanques: boolean = true; // MUDE PARA TRUE
  carregandoCarrossel: boolean = true; // MUDE PARA TRUE
  medicoesRecentes: any[] = [];
  carregandoMedicoes: boolean = true;

  // --- VARIÁVEIS DO DASHBOARD DO AUDITOR ---
  medicoesPendentes: any[] = [];
  medicoesProcessadas: any[] = [];
  medicaoSelecionada: any = null; // Guarda a medição que foi clicada para enviar ao Monitoramento

  // --- CONSTRUTOR ---
  constructor(
    private web3Service: Web3Service,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    this.iniciarCarrossel();
    
    // Garante conexão antes de buscar os dados
    if (!this.web3Service.address) {
      await this.web3Service.checkConnection();
    }

    // Verifica o cargo do usuário
    await this.carregarPermissoes(); 

    // Busca os dados iniciais gerais
    this.carregarUltimasMedicoes();
    this.carregarTanques(); 

    // 👇 ADICIONE ESTA LINHA PARA BUSCAR OS PENDENTES PARA A HOME UNIFICADA
    this.carregarMedicoesPendentes(); 
  }

  ngOnDestroy() {
    this.pararCarrossel();
  }

  // --- CONTROLE DE PERMISSÕES ---
  async carregarPermissoes() {
    try {
      const accessContract = this.web3Service.contracts.access;
      if (!accessContract) return;

      const endereco = this.web3Service.address;
      console.log("🕵️ 1. Endereço reconhecido pelo Angular:", endereco);

      const CARETAKER_ROLE = await accessContract.CARETAKER_ROLE();
      const AUDITOR_ROLE = await accessContract.AUDITOR_ROLE();

      const isCaretaker = await accessContract.hasRole(CARETAKER_ROLE, endereco);
      const isAuditor = await accessContract.hasRole(AUDITOR_ROLE, endereco);

      console.log("🕵️ 2. A blockchain diz que é Operador?", isCaretaker);
      console.log("🕵️ 3. A blockchain diz que é Auditor?", isAuditor);

      if (isCaretaker) {
        this.cargoUsuario = 'operador';
      } else if (isAuditor) {
        this.cargoUsuario = 'auditor';
      } else {
        this.cargoUsuario = 'nenhum';
      }

      console.log("🕵️ 4. Visão final escolhida para a tela:", this.cargoUsuario);

      this.cdr.detectChanges(); 
    } catch (error) {
      console.error('Erro ao verificar cargo:', error);
    }
  }

  // --- FUNÇÕES DE NAVEGAÇÃO E ABAS ---
  navegarMenuLateral(menu: string, event: Event) {
    event.preventDefault();
    this.menuAtivoLateral = menu;

    if (menu === 'home') {
      this.tituloPagina = 'Home';
      this.subtituloPagina = 'Bem-vindo ao painel de gestão';
    } else if (menu === 'tanques') {
      this.tituloPagina = 'Tanques';
      this.subtituloPagina = 'Gerenciar tanques no AxoloRegistry';
    } else if (menu === 'axolotes') {
      this.tituloPagina = 'Axolotes';
      this.subtituloPagina = 'Cadastrar e consultar axolotes';
    } else if (menu === 'monitoramento') {
      this.tituloPagina = 'Medições Ambientais';
      this.subtituloPagina = 'Valores em decimais. O sistema converterá para o Smart Contract.';
    }
  }

  selecionarAba(aba: string) {
    this.abaAtiva = aba;
  }

  // --- FUNÇÕES DO CARROSSEL ANIMADO ---
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

  // --- FUNÇÃO DE BUSCA DOS TANQUES ---
  async carregarTanques() {
    this.carregandoTanques = true;
    try {
      if (!this.web3Service.contracts?.registry) return;

      const contract = this.web3Service.contracts.registry;
      const totalBigInt = await contract.nextTankId();
      const total = Number(totalBigInt);

      const promessasDeBusca = [];

      for (let i = 1; i < total; i++) {
        promessasDeBusca.push(contract.getTank(i));
      }

      const resultados = await Promise.all(promessasDeBusca);

      const tempTanques: any[] = [];
      resultados.forEach((t) => {
        if (t.active) {
          tempTanques.push({
            id: Number(t.id),
            name: t.name,
            location: t.location,
          });
        }
      });

      this.tanquesRegistrados = tempTanques;
      this.cdr.detectChanges(); 
    } catch (error) {
      console.error('Erro ao carregar tanques na Home:', error);
    } finally {
      this.carregandoTanques = false;
    }
  }

  // --- FUNÇÃO QUE BUSCA AS MEDIÇÕES NA BLOCKCHAIN ---
  async carregarUltimasMedicoes() {
    this.carregandoMedicoes = true;
    try {
      const contract = this.web3Service.contracts.monitoring;
      if (!contract) return;

      const nextId = await contract.nextMeasurementId();
      const total = Number(nextId);

      if (total <= 1) {
        this.carregandoMedicoes = false;
        return;
      }

      this.medicoesRecentes = [];
      let quantidadeNaTela = 0; // Contador para limitar a 5 itens

      // Percorre as medições de trás pra frente
      for (let i = total - 1; i >= 1; i--) {
        const m = await contract.getMeasurement(i);
        const statusRegistro = Number(m.status);

        // O SEGREDO: Só entra se for DIFERENTE de 0 (Pendente)
        if (statusRegistro !== 0) {
          
          const statusMap: any = {
            1: { texto: 'Validado', classe: 'status-accepted' },
            2: { texto: 'Contestado', classe: 'status-contested' },
          };
          const statusInfo = statusMap[statusRegistro];

          this.medicoesRecentes.push({
            id: Number(m.id),
            tankId: Number(m.tankId),
            temperatura: (Number(m.temperature) / 100).toFixed(2),
            ph: (Number(m.ph) / 100).toFixed(2),
            statusTexto: statusInfo.texto,
            statusClasse: statusInfo.classe,
          });

          quantidadeNaTela++;
          
          // Quando achar 5 registros finalizados, para de procurar
          if (quantidadeNaTela >= 5) {
            break; 
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      this.carregandoMedicoes = false;
      this.cdr.detectChanges(); // Atualiza a tela
    }
  }

  // ==========================================
  // FUNÇÕES EXCLUSIVAS DO AUDITOR (HOME)
  // ==========================================
  async carregarMedicoesPendentes() {
    try {
      const monContract = this.web3Service.contracts.monitoring;
      const regContract = this.web3Service.contracts.registry;
      if (!monContract || !regContract) return;

      const totalMedicoes = Number(await monContract.nextMeasurementId());
      const pendentesTemp: any[] = [];
      const processadasTemp: any[] = [];

      for (let i = totalMedicoes - 1; i >= 1; i--) {
        const m = await monContract.getMeasurement(i);
        const tId = Number(m.tankId);
        
        let nomeTanque = `Tanque #${tId}`;
        try {
          const t = await regContract.getTank(tId);
          nomeTanque = t.name;
        } catch (e) {}

        const medFormatada = {
          id: Number(m.id),
          tankId: tId,
          nomeTanque: nomeTanque,
          temperatura: (Number(m.temperature) / 100).toFixed(1),
          ph: (Number(m.ph) / 100).toFixed(1),
          o2: (Number(m.dissolvedOxygen) / 100).toFixed(1),
          condutividade: (Number(m.conductivity) / 100).toFixed(0),
          no3: (Number(m.no3) / 100).toFixed(1),
          no2: (Number(m.no2) / 100).toFixed(2),
          dataHora: new Date(Number(m.timestamp) * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
          status: Number(m.status)
        };

        if (Number(m.status) === 0) {
          pendentesTemp.push(medFormatada);
        } else {
          processadasTemp.push(medFormatada);
        }
      }
      
      this.medicoesPendentes = pendentesTemp;
      this.medicoesProcessadas = processadasTemp;
      this.cdr.detectChanges();
    } catch (error) {
      console.error("Erro ao carregar auditoria:", error);
    }
  }

  // Quando o auditor clica em uma medição pendente
  abrirAuditoria(med: any) {
    this.medicaoSelecionada = med; // Salva a medição
    this.menuAtivoLateral = 'monitoramento'; // "Teletransporta" para a aba de monitoramento
  }

  // Quando o auditor clica em voltar ou termina a avaliação na tela de monitoramento
  voltarDaAuditoria() {
    this.medicaoSelecionada = null; // Limpa a seleção
    this.menuAtivoLateral = 'home'; // Volta pra Home
    this.carregarMedicoesPendentes(); // Atualiza a lista pra sumir o que ele acabou de aprovar!
  }
}