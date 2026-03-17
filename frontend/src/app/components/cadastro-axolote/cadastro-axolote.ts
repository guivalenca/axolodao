import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Web3Service } from '../../services/web3';
import { ethers } from 'ethers';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cadastro-axolote',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cadastro-axolote.html',
  styleUrls: ['./cadastro-axolote.css'],
})
export class CadastroAxolote implements OnInit {
  // Variáveis do formulário
  nome: string = '';
  especie: string = '';
  dataNascimento: string = '';
  tanqueId: number | null = null;
  morfologia: string = '';

  // Variáveis de controle
  enderecoResponsavel: string = '';
  enviandoTx: boolean = false;

  constructor(private web3Service: Web3Service) {}

  async ngOnInit() {
    // Pega o endereço da carteira conectada para preencher o campo "Responsável"
    if (!this.web3Service.address) {
      await this.web3Service.checkConnection();
    }
    this.enderecoResponsavel = this.web3Service.address;
  }

  async cadastrarAxolote() {
    if (!this.nome || !this.especie || !this.dataNascimento || !this.tanqueId || !this.morfologia) {
      Swal.fire('Atenção', 'Preencha todos os campos do axolote!', 'warning');
      return;
    }

    this.enviandoTx = true;

    try {
      const contract = this.web3Service.contracts.registry;

      // 1. Converte a data do HTML (YYYY-MM-DD) para Timestamp (segundos)
      const dataObj = new Date(this.dataNascimento);
      const timestampNascimento = Math.floor(dataObj.getTime() / 1000);

      // 2. Hash temporário para a foto (Enquanto não usamos IPFS)
      // 2. Hash temporário VÁLIDO para a foto
      const dummyPhotoHash = ethers.id('foto_temporaria_do_julius');

      // 3. Envia para a Blockchain
      const tx = await contract.registerAxolotl(
        this.nome,
        this.especie,
        Number(timestampNascimento), // Garante que é número
        Number(this.tanqueId), // Garante que é número
        this.morfologia,
        dummyPhotoHash,
      );

      Swal.fire({
        title: 'Registrando...',
        text: 'Aguarde a confirmação da rede Sepolia.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      await tx.wait();

      Swal.fire('Sucesso!', 'Axolote registrado no AxoloDAO!', 'success');
      this.limparFormulario();
    } catch (error) {
      console.error('Erro ao cadastrar axolote:', error);
      Swal.fire('Erro', 'Falha ao registrar na blockchain.', 'error');
    } finally {
      this.enviandoTx = false;
    }
  }

  limparFormulario() {
    this.nome = '';
    this.especie = '';
    this.dataNascimento = '';
    this.tanqueId = null;
    this.morfologia = '';
  }
}
