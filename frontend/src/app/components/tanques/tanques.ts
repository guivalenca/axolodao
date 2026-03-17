import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; // Adicionado OnInit aqui
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Web3Service } from '../../services/web3';
import Swal from 'sweetalert2'; // Dica: use o Swal para mensagens mais bonitas

@Component({
  selector: 'app-tanques',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tanques.html',
  styleUrls: ['./tanques.css'],
})
export class Tanques implements OnInit {
  // --- VARIÁVEIS DE ESTADO ---
  tanques: any[] = [];
  axolotesDoTanque: any[] = [];
  tanqueSelecionadoId: number = 1;
  termoBuscaAxolote: string = '';
  loading: boolean = false;

  // --- VARIÁVEIS DO FORMULÁRIO (Cadastro de Tanque) ---
  novoTanqueNome: string = '';
  novoTanqueLocal: string = '';
  enviandoTx: boolean = false;

  ultimaMedicao: any = null;
  carregandoMedicao: boolean = false;

  constructor(
    private web3Service: Web3Service,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    // 1. Aguarda o endereço da carteira estar disponível no serviço
    // Isso garante que os contratos já foram instanciados
    if (!this.web3Service.address) {
      console.log('Aguardando conexão com a carteira...');
      await this.web3Service.checkConnection();
    }

    // 2. Só tenta carregar se o contrato realmente existir
    if (this.web3Service.contracts?.registry) {
      await this.carregarTanques();
    } else {
      // Se ainda não estiver pronto, tenta de novo em 1 segundo (plano B)
      setTimeout(() => this.ngOnInit(), 1000);
    }
  }

  async carregarTanques() {
    try {
      const contract = this.web3Service.contracts.registry;
      const totalBigInt = await contract.nextTankId();
      const total = Number(totalBigInt);

      // 1. Cria uma lista vazia de "pedidos" para a blockchain
      const promessasDeBusca = [];

      // 2. Prepara todos os pedidos de uma vez só (sem o await aqui!)
      for (let i = 1; i < total; i++) {
        promessasDeBusca.push(contract.getTank(i));
      }

      // 3. DISPARA TUDO EM PARALELO! (Isso reduz o tempo de segundos para milissegundos)
      const resultados = await Promise.all(promessasDeBusca);

      // 4. Filtra apenas os ativos e monta a lista da tela
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

      this.tanques = tempTanques;

      // 5. O Despertador: Força o Angular a desenhar os botões na tela IMEDIATAMENTE
      this.cdr.detectChanges();

      // Opcional: Já seleciona o primeiro tanque super rápido também
      if (this.tanques.length > 0 && !this.tanqueSelecionadoId) {
        this.selecionarTanque(this.tanques[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar tanques:', error);
    }
  }

  async selecionarTanque(id: number) {
    this.tanqueSelecionadoId = id;
    this.loading = true;

    try {
      // 1. Dispara as duas buscas em paralelo (Axolotes + Água)
      await Promise.all([
        this.buscarAxolotesDoTanque(id), // Aquela lógica do contrato.getAxolotlsInTank que você já fez
        this.buscarUltimaMedicaoAgua(id), // A nova função abaixo!
      ]);
    } catch (error) {
      console.error('Erro ao selecionar tanque:', error);
    } finally {
      this.loading = false;
    }
  }

  // A MÁGICA QUE PEGA OS DADOS DA ÁGUA:
  async buscarUltimaMedicaoAgua(tankId: number) {
    this.carregandoMedicao = true;
    this.ultimaMedicao = null; // Limpa a medição anterior da tela

    try {
      const contract = this.web3Service.contracts.monitoring;
      if (!contract) return;

      const total = Number(await contract.nextMeasurementId());

      // Loop de trás pra frente (pega a mais recente primeiro)
      for (let i = total - 1; i >= 1; i--) {
        const m = await contract.getMeasurement(i);

        // Se a medição pertence ao tanque que clicamos, achamos!
        if (Number(m.tankId) === tankId) {
          // Formata os números (dividindo por 100 conforme seu Smart Contract)
          this.ultimaMedicao = {
            temperatura: (Number(m.temperature) / 100).toFixed(1),
            ph: (Number(m.ph) / 100).toFixed(1),
            amonia: (Number(m.ammonia) / 100).toFixed(2),
            nitritos: (Number(m.no2) / 100).toFixed(0),
            dataHora: new Date(Number(m.timestamp) * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          break; // Achou a última, para o loop!
        }
      }
    } catch (error) {
      console.error('Erro ao buscar medição da água:', error);
    } finally {
      this.carregandoMedicao = false;
      this.cdr.detectChanges();
    }
  }

  async buscarAxolotesDoTanque(tankId: number) {
    try {
      const contract = this.web3Service.contracts.registry;
      if (!contract) return;

      // Descobre quais são os IDs dos axolotes que moram neste tanque
      const ids = await contract.getAxolotlsInTank(tankId);

      // Busca os dados de todos eles ao mesmo tempo (Versão Turbo)
      const promessasAxolotes = [];
      for (const axId of ids) {
        promessasAxolotes.push(contract.getAxolotl(axId));
      }

      const resultadosAxolotes = await Promise.all(promessasAxolotes);
      
      const tempAxolotes: any[] = [];
      resultadosAxolotes.forEach(ax => {
        if (ax.active) {
          tempAxolotes.push({
            id: Number(ax.id),
            name: ax.name,
            img: 'assets/axolotes-loginPage.png', // Imagem padrão por enquanto
          });
        }
      });

      this.axolotesDoTanque = tempAxolotes;
      this.cdr.detectChanges();

    } catch (error) {
      console.error('Erro ao buscar axolotes da barra lateral:', error);
    }
  }

  // --- FILTRO DE BUSCA (Sidebar) ---
  get axolotesFiltrados() {
    return this.axolotesDoTanque.filter((ax) =>
      ax.name.toLowerCase().includes(this.termoBuscaAxolote.toLowerCase()),
    );
  }

  // --- AÇÃO: REGISTRAR NOVO TANQUE ---
  async registrarTanque() {
    if (!this.novoTanqueNome || !this.novoTanqueLocal) {
      Swal.fire('Ops!', 'Preencha nome e localização.', 'warning');
      return;
    }

    try {
      this.enviandoTx = true;
      const tx = await this.web3Service.contracts.registry.registerTank(
        this.novoTanqueNome,
        this.novoTanqueLocal,
      );

      await tx.wait();

      Swal.fire('Sucesso!', 'Tanque registrado na blockchain.', 'success');

      // Limpa o formulário e recarrega a lista
      this.novoTanqueNome = '';
      this.novoTanqueLocal = '';
      await this.carregarTanques();
    } catch (error: any) {
      console.error(error);
      Swal.fire('Erro', 'Falha ao registrar tanque.', 'error');
    } finally {
      this.enviandoTx = false;
    }
  }
}
