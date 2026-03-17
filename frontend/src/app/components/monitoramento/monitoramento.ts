import { Component, OnInit, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Web3Service } from '../../services/web3'; 
import Swal from 'sweetalert2';

@Component({
  selector: 'app-monitoramento',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './monitoramento.html',
  styleUrls: ['./monitoramento.css']
})
export class Monitoramento implements OnInit {
  
  // ==========================================
  // PORTAS DE ENTRADA/SAÍDA (Comunicação com a Home)
  // ==========================================
  @Input() medicaoParaAvaliar: any = null;
  @Output() fecharAuditoria = new EventEmitter<void>();

  // === VARIÁVEL DE CONTROLE DE ACESSO (RBAC) ===
  cargoUsuario: 'operador' | 'auditor' | 'nenhum' = 'nenhum';

  // === CONTROLE DAS ABAS ===
  abaAtiva: string = 'tanques'; 

  // === VARIÁVEIS DE FORMULÁRIOS (Visão do Operador) ===
  medicaoForm!: FormGroup;
  tanquesDisponiveis: any[] = [];
  carregandoTanques: boolean = false;
  
  axoloteForm!: FormGroup;
  axolotesDisponiveis: any[] = [];
  carregandoAxolotes: boolean = false;
  
  enviandoTx: boolean = false;

  // === VARIÁVEIS PARA O HISTÓRICO GERAL ===
  medicoesValidadas: any[] = [];
  carregandoHistorico: boolean = false;

  constructor(
    private web3Service: Web3Service,
    private cdr: ChangeDetectorRef 
  ) {}

  async ngOnInit() {
    this.inicializarFormularios();
    await this.carregarPermissoes();
  }

  inicializarFormularios() {
    this.medicaoForm = new FormGroup({
      mTankId: new FormControl('', Validators.required),
      mTemp: new FormControl('', Validators.required),
      mPh: new FormControl('', Validators.required),
      mO2: new FormControl('', Validators.required),
      mCond: new FormControl('', Validators.required),
      mTurb: new FormControl('', Validators.required),
      mPhos: new FormControl('', Validators.required),
      mNo2: new FormControl('', Validators.required),
      mNo3: new FormControl('', Validators.required),
      mNh3: new FormControl('', Validators.required),
      mGh: new FormControl('', Validators.required)
    });

    this.axoloteForm = new FormGroup({
      aAxoloteId: new FormControl('', Validators.required),
      aPeso: new FormControl('', [Validators.required, Validators.min(0)]),
      aTamanho: new FormControl('', [Validators.required, Validators.min(0)]),
      aApetite: new FormControl('Normal', Validators.required),
      aGuelras: new FormControl('Saudavel', Validators.required),
      aObs: new FormControl('')
    });
  }

  // === FUNÇÃO QUE BUSCA O CARGO NA BLOCKCHAIN ===
  async carregarPermissoes() {
    try {
      await this.web3Service.checkConnection();
      const accessContract = this.web3Service.contracts.access; 
      if (!accessContract) return;

      const endereco = this.web3Service.address;

      const CARETAKER_ROLE = await accessContract.CARETAKER_ROLE();
      const AUDITOR_ROLE = await accessContract.AUDITOR_ROLE();

      const isCaretaker = await accessContract.hasRole(CARETAKER_ROLE, endereco);
      const isAuditor = await accessContract.hasRole(AUDITOR_ROLE, endereco);

      if (isCaretaker) {
        this.cargoUsuario = 'operador';
        this.carregarTanques();
        this.carregarAxolotes();
      } else if (isAuditor) {
        this.cargoUsuario = 'auditor';
      } else {
        this.cargoUsuario = 'nenhum';
      }

      this.cdr.detectChanges(); 
    } catch (error) {
      console.error("Erro ao verificar cargo:", error);
    }
  }

  selecionarAba(aba: string) {
    this.abaAtiva = aba;
    if (aba === 'historico') {
      this.carregarDadosCruzados();
    }
  }

  // === FUNÇÕES DE BUSCA (GET) PARA OPERADOR ===
  async carregarTanques() {
    this.carregandoTanques = true;
    try {
      const contract = this.web3Service.contracts.registry;
      if (!contract) return;

      const nextId = await contract.nextTankId();
      this.tanquesDisponiveis = [];
      
      for (let i = 1; i < Number(nextId); i++) {
        const t = await contract.getTank(i);
        if (t.active) {
          this.tanquesDisponiveis.push({ id: Number(t.id), nome: t.name });
        }
      }
    } catch (error) {
      console.error("Erro ao carregar tanques:", error);
    } finally {
      this.carregandoTanques = false;
      this.cdr.detectChanges();
    }
  }

  async carregarAxolotes() {
    this.carregandoAxolotes = true;
    try {
      const contract = this.web3Service.contracts.registry; 
      if (!contract) return;

      const nextId = await contract.nextAxolotlId(); 
      this.axolotesDisponiveis = [];
      
      for (let i = 1; i < Number(nextId); i++) {
        const ax = await contract.getAxolotl(i); 
        if (ax.active) {
          this.axolotesDisponiveis.push({ id: Number(ax.id), nome: ax.name });
        }
      }
    } catch (error) {
      console.error("Erro ao carregar axolotes:", error);
    } finally {
      this.carregandoAxolotes = false;
      this.cdr.detectChanges();
    }
  }

  // ==========================================
  // FUNÇÕES DE AVALIAÇÃO DO AUDITOR
  // ==========================================
  
  voltarParaPendentes() {
    this.fecharAuditoria.emit(); // Emite o sinal para a Home fechar esta tela
  }

  async aceitarMedicao() {
    this.enviandoTx = true;
    try {
      const tx = await this.web3Service.contracts.monitoring.validateMeasurement(BigInt(this.medicaoParaAvaliar.id));
      
      Swal.fire('Validando...', 'Aguarde a confirmação da rede.', 'info');
      await tx.wait();
      
      Swal.fire('Sucesso!', 'Medição aprovada e registrada no histórico!', 'success');
      this.voltarParaPendentes();
    } catch (error: any) {
      console.error("Erro detalhado ao Aceitar:", error);
      let msgErro = error.reason || error.info?.error?.message || error.message || 'Falha ao aprovar medição.';
      Swal.fire('Transação Rejeitada', msgErro, 'error');
    } finally {
      this.enviandoTx = false;
    }
  }

  async recusarMedicao() {
    const { value: motivo } = await Swal.fire({
      title: 'Contestar Medição',
      input: 'text',
      inputLabel: 'Qual o motivo da recusa?',
      inputPlaceholder: 'Ex: Sensores descalibrados',
      showCancelButton: true,
      confirmButtonColor: '#E74C3C',
      confirmButtonText: 'Recusar Medição',
      cancelButtonText: 'Cancelar'
    });

    if (motivo) {
      this.enviandoTx = true;
      try {
        const tx = await this.web3Service.contracts.monitoring.contestMeasurement(BigInt(this.medicaoParaAvaliar.id), motivo);
        
        Swal.fire('Contestando...', 'Aguarde a confirmação da rede.', 'info');
        await tx.wait();
        
        Swal.fire('Contestada!', 'A medição foi recusada com sucesso.', 'success');
        this.voltarParaPendentes();
      } catch (error: any) {
        console.error("Erro detalhado ao Recusar:", error);
        let msgErro = error.reason || error.info?.error?.message || error.message || 'Falha ao recusar medição.';
        Swal.fire('Transação Rejeitada', msgErro, 'error');
      } finally {
        this.enviandoTx = false;
      }
    }
  }

  // === HISTÓRICO CRUZADO ===
  async carregarDadosCruzados() {
    this.carregandoHistorico = true;
    try {
      const regContract = this.web3Service.contracts.registry;
      const monContract = this.web3Service.contracts.monitoring;
      if (!regContract || !monContract) return;

      const totalTanques = Number(await regContract.nextTankId());
      const mapaTanques = new Map<number, string>(); 
      for (let i = 1; i < totalTanques; i++) {
        const t = await regContract.getTank(i);
        if (t.active) mapaTanques.set(Number(t.id), t.name);
      }

      const totalAxolotes = Number(await regContract.nextAxolotlId());
      const axolotesPorTanque = new Map<number, string[]>(); 
      for (let i = 1; i < totalAxolotes; i++) {
        const ax = await regContract.getAxolotl(i);
        if (ax.active) {
          const tId = Number(ax.tankId);
          if (!axolotesPorTanque.has(tId)) axolotesPorTanque.set(tId, []);
          axolotesPorTanque.get(tId)!.push(ax.name);
        }
      }

      const totalMedicoes = Number(await monContract.nextMeasurementId());
      const tempLista: any[] = []; 

      for (let i = totalMedicoes - 1; i >= 1; i--) {
        const m = await monContract.getMeasurement(i);

        if (Number(m.status) === 1) { 
          const tId = Number(m.tankId);
          tempLista.push({
            id: Number(m.id),
            nomeTanque: mapaTanques.get(tId) || `Tanque Desconhecido (#${tId})`,
            habitantes: axolotesPorTanque.get(tId) || [], 
            temperatura: (Number(m.temperature) / 100).toFixed(1),
            ph: (Number(m.ph) / 100).toFixed(1),
            amonia: (Number(m.ammonia) / 100).toFixed(2),
            nitritos: (Number(m.no2) / 100).toFixed(0),
            dataHora: new Date(Number(m.timestamp) * 1000).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })
          });
        }
      }
      this.medicoesValidadas = tempLista;
    } catch (error) {
      console.error("Erro ao cruzar dados de monitoramento:", error);
    } finally {
      this.carregandoHistorico = false;
      this.cdr.detectChanges();
    }
  }


  // === FUNÇÕES DE ENVIO (POST / FORMULÁRIOS) ===
  preencherTeste() {
    this.medicaoForm.patchValue({
      mTemp: 19.50, mPh: 7.20, mO2: 7.10, mCond: 300, 
      mTurb: 1.00, mPhos: 0.50, mNo2: 0.03, mNo3: 10.00, 
      mNh3: 0.02, mGh: 8.00
    });
  }

  async registrarMedicao() {
    if (this.medicaoForm.invalid) {
      Swal.fire('Atenção', 'Preencha todos os campos obrigatórios!', 'warning');
      return;
    }

    const form = this.medicaoForm.value;
    let alertasBiologicos: string[] = []; 

    if (form.mTemp > 20 || form.mTemp < 14) {
      alertasBiologicos.push(`🌡️ Temperatura em <b>${form.mTemp}°C</b> (Ideal: 16°C - 18°C)`);
    }
    if (form.mPh < 6.5 || form.mPh > 8.0) {
      alertasBiologicos.push(`🧪 pH em <b>${form.mPh}</b> (Ideal: 6.5 - 8.0)`);
    }
    if (form.mNh3 > 0) {
      alertasBiologicos.push(`☠️ Amônia em <b>${form.mNh3} mg/L</b> (Ideal: 0)`);
    }

    if (alertasBiologicos.length > 0) {
      const confirmacao = await Swal.fire({
        title: '⚠️ Parâmetros Críticos!',
        html: `Os valores abaixo são perigosos para os axolotes:<br><br> ${alertasBiologicos.join('<br>')} <br><br><b>Registrar mesmo assim?</b>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#E74C3C',
        cancelButtonColor: '#95A5A6',
        confirmButtonText: 'Sim, registrar',
        cancelButtonText: 'Não, corrigir'
      });
      if (!confirmacao.isConfirmed) return; 
    }

    this.enviandoTx = true;
    try {
      const parametros = {
        tankId: BigInt(form.mTankId),
        temperature: Math.round(form.mTemp * 100),
        ph: Math.round(form.mPh * 100),
        dissolvedOxygen: Math.round(form.mO2 * 100),
        conductivity: Math.round(form.mCond * 100),
        turbidity: Math.round(form.mTurb * 100),
        phosphates: Math.round(form.mPhos * 100),
        no2: Math.round(form.mNo2 * 100),
        no3: Math.round(form.mNo3 * 100),
        ammonia: Math.round(form.mNh3 * 100),
        hardness: Math.round(form.mGh * 100)
      };

      const tx = await this.web3Service.contracts.monitoring.recordMeasurement(parametros);
      
      Swal.fire('Transação Enviada', 'Aguardando mineração na blockchain...', 'info');
      await tx.wait(); 

      Swal.fire('Sucesso!', 'Medição registrada na blockchain.', 'success');
      this.medicaoForm.reset(); 

    } catch (error: any) {
      Swal.fire('Erro', error.reason || error.message || 'Falha ao registrar medição.', 'error');
    } finally {
      this.enviandoTx = false;
    }
  }

  async registrarSaudeAxolote() {
    if (this.axoloteForm.invalid) {
      Swal.fire('Atenção', 'Preencha os campos obrigatórios!', 'warning');
      return;
    }

    const form = this.axoloteForm.value;
    this.enviandoTx = true;

    try {
      const parametros = {
        axolotlId: BigInt(form.aAxoloteId),
        weight: Math.round(form.aPeso * 100),
        size: Math.round(form.aTamanho * 100),
        appetite: form.aApetite,
        gills: form.aGuelras,
        observations: form.aObs || "Sem observações"
      };

      const tx = await this.web3Service.contracts.monitoring.recordAxolotlHealth(
        parametros.axolotlId, 
        parametros.weight, 
        parametros.size, 
        parametros.appetite, 
        parametros.gills, 
        parametros.observations
      );
      
      Swal.fire('Transação Enviada', 'Aguardando mineração...', 'info');
      await tx.wait(); 

      Swal.fire('Sucesso!', 'Saúde do Axolote registrada na blockchain.', 'success');
      this.axoloteForm.reset({ aApetite: 'Normal', aGuelras: 'Saudavel' }); 

    } catch (error: any) {
      Swal.fire('Erro', error.reason || error.message || 'Falha ao registrar saúde.', 'error');
    } finally {
      this.enviandoTx = false;
    }
  }
}