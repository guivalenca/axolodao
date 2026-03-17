import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // MUDOU AQUI (ngModel)
import { Web3Service } from '../../services/web3';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cadastro-tanque',
  standalone: true,
  imports: [CommonModule, FormsModule], // MUDOU AQUI
  templateUrl: './cadastro-tanque.html',
  styleUrls: ['./cadastro-tanque.css']
})
export class CadastroTanque implements OnInit {
  
  // Variáveis do formulário ligadas pelo ngModel
  nomeTanque: string = '';
  localizacao: string = '';
  
  // Controle de tela
  enderecoResponsavel: string = '';
  enviandoTx: boolean = false;

  constructor(private web3Service: Web3Service) {}

  async ngOnInit() {
    // Pega a carteira conectada para mostrar no campo "Responsável"
    if (this.web3Service.address) {
      this.enderecoResponsavel = this.web3Service.address;
    } else {
      await this.web3Service.checkConnection();
      this.enderecoResponsavel = this.web3Service.address;
    }
  }

  async cadastrarTanque() {
    // Validação simples
    if (!this.nomeTanque || !this.localizacao) {
      Swal.fire('Atenção', 'Preencha todos os campos obrigatórios.', 'warning');
      return;
    }

    this.enviandoTx = true;

    try {
      // Chama a função do Smart Contract (AxoloRegistry)
      // Ajuste o nome "registerTank" se estiver diferente no seu .sol
      const tx = await this.web3Service.contracts.registry.registerTank(
        this.nomeTanque, 
        this.localizacao
      );
      
      Swal.fire('Transação Enviada', 'Aguardando confirmação na rede...', 'info');
      await tx.wait(); 

      Swal.fire('Sucesso!', 'Novo tanque registrado na blockchain.', 'success');
      
      // Limpa os campos após o sucesso
      this.nomeTanque = '';
      this.localizacao = '';

    } catch (error: any) {
      console.error("Erro ao registrar tanque:", error);
      let msgErro = error.reason || error.info?.error?.message || error.message || 'Falha ao registrar tanque.';
      Swal.fire('Erro na Transação', msgErro, 'error');
    } finally {
      this.enviandoTx = false;
    }
  }
}