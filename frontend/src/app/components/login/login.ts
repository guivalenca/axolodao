import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router'; // <-- 1. ADICIONE ESTA LINHA
import { ethers } from 'ethers';
import { Web3Service } from '../../services/web3';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], 
  templateUrl: './login.html', 
  styleUrls: ['./login.css'] 
})
export class Login implements OnInit {
  mostrarCamposCarteira: boolean = false;
  walletAddress: string = ''; // <-- Nova variável para guardar a carteira
  logMensagem: string = '';
  loginForm!: FormGroup;

  constructor(private web3Service: Web3Service, private router: Router) {}

  ngOnInit() {
    this.loginForm = new FormGroup({
      ensLabel: new FormControl('', Validators.required),
      ensInst: new FormControl('', Validators.required)
    });

    // Chama a verificação silenciosa assim que a tela abre
    this.verificarConexaoExistente();
  }

  // --- NOVA FUNÇÃO NO COMPONENTE ---
  async verificarConexaoExistente() {
    try {
      const connectedAddress = await this.web3Service.checkConnection();
      
      if (connectedAddress) {
        // Se já estava conectado, pula o botão e vai direto para o formulário!
        this.walletAddress = connectedAddress;
        this.mostrarCamposCarteira = true;
        this.logMensagem = 'Carteira detectada automaticamente!';
      }
    } catch (error) {
      console.error("Erro ao verificar conexão:", error);
    }
  }

  get nomeEnsCompleto(): string {
    const label = this.loginForm.get('ensLabel')?.value;
    const inst = this.loginForm.get('ensInst')?.value;
    if (!label || !inst) return '';
    return `${label}.${inst}.axolodao.eth`;
  }

  get parentNodeCalculado(): string {
    const inst = this.loginForm.get('ensInst')?.value;
    if (!inst) return '';
    return ethers.namehash(`${inst}.axolodao.eth`); 
  }

  // --- PASSO 1: CONECTA A CARTEIRA E REVELA OS CAMPOS ---
  async conectarCarteira() {
    try {
      this.logMensagem = 'Abrindo MetaMask...';
      
      // Chama o serviço para conectar
      const address = await this.web3Service.connectWallet();
      
      // Salva o endereço e mostra os campos do ENS
      this.walletAddress = address;
      this.mostrarCamposCarteira = true;
      this.logMensagem = 'Carteira conectada! Preencha seus dados.';
      
    } catch (error: any) {
      console.error(error);
      this.logMensagem = `Erro: ${error.message || 'Falha ao conectar'}`;
    }
  }

  // --- PASSO 2: REGISTRA O ENS NO SMART CONTRACT ---
  async registrarAcesso() {
    if (this.loginForm.invalid) {
      this.logMensagem = 'Preencha a Label e a Instituição!';
      return;
    }

    const labelEns = this.loginForm.get('ensLabel')?.value;

    try {
      const tx = await this.web3Service.contracts.access.registrarAcesso(
        labelEns, 
        this.parentNodeCalculado
      );
      
      this.logMensagem = `Transação enviada! Aguardando mineração...`;
      await tx.wait(); 
      
      this.logMensagem = 'Acesso registrado com sucesso!';
      
      // 3. ADICIONE ESTA LINHA PARA MUDAR DE TELA!
      // (Verifique se o nome da rota da sua tela principal é 'tela-inicial' ou 'home')
      this.router.navigate(['/tela-inicial']); 

    } catch (error: any) {
      console.error(error);
      this.logMensagem = `Erro: ${error.reason || error.message || 'Falha na transação'}`;
    }
  } catch (error: any) {
      console.error(error);
      this.logMensagem = `Erro: ${error.reason || error.message || 'Falha na transação'}`;
    }
  }