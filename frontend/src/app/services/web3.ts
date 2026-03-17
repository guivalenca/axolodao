import { Injectable } from '@angular/core';
import { ethers } from 'ethers';

// 1. Endereços dos seus Contratos
const ADDR = {
  access: '0xd53a73274E1A11837bb234C74146c75Ca9De0857',
  registry: '0x8d4B02ff042d47Dc90E880F9b7CaA250946f2FE4',
  monitoring: '0x5FdF5Be72f86d25ce467878def45cE8A89D01a72',
};

// 2. ABIs (Resumidas para focar nas funções principais do seu script)
const ABI_ACCESS = [
  'function registrarAcesso(string memory label, bytes32 parentNode) public',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function CARETAKER_ROLE() view returns (bytes32)',
  'function AUDITOR_ROLE() view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
];

const ABI_REGISTRY = [
  'function registerTank(string memory name, string memory location) public returns (uint256)',
  'function registerAxolotl(string memory name, string memory species, uint256 birthDate, uint256 tankId, string memory morphData, bytes32 photoHash) public returns (uint256)',
  'function getTank(uint256 tankId) view returns (tuple(uint256 id, string name, string location, address registeredBy, uint256 registeredAt, bool active))',
  'function nextTankId() view returns (uint256)',
  // --- ADICIONADAS PARA RESOLVER OS ERROS ---
  'function getAxolotl(uint256 axolotlId) view returns (tuple(uint256 id, string name, string species, uint256 birthDate, uint256 tankId, string morphData, bytes32 photoHash, address registeredBy, uint256 registeredAt, bool active))',
  'function nextAxolotlId() view returns (uint256)',
  'function getAxolotlsInTank(uint256 tankId) view returns (uint256[])',
];

const ABI_MONITORING = [
  'function nextMeasurementId() view returns (uint256)',
  'function recordMeasurement(tuple(uint256 tankId, uint16 temperature, uint16 ph, uint16 dissolvedOxygen, uint16 conductivity, uint16 turbidity, uint16 phosphates, uint16 no2, uint16 no3, uint16 ammonia, uint16 hardness) p) external returns (uint256)',
  'function getMeasurement(uint256 measurementId) view returns (tuple(uint256 id, uint256 tankId, address recorder, uint256 timestamp, uint16 temperature, uint16 ph, uint16 dissolvedOxygen, uint16 conductivity, uint16 turbidity, uint16 phosphates, uint16 no2, uint16 no3, uint16 ammonia, uint16 hardness, uint8 status, address validator, uint256 validatedAt, string contestReason))',
  'function recordAxolotlHealth(uint256 _axolotlId, uint16 _weight, uint16 _size, string _appetite, string _gills, string _observations) external',
  
  // --- AS FUNÇÕES DE AUDITORIA (Agora no formato correto) ---
  'function validateMeasurement(uint256 measurementId) external',
  'function contestMeasurement(uint256 measurementId, string reason) external'
];

@Injectable({
  providedIn: 'root',
})
export class Web3Service {
  public provider: any;
  public signer: any;
  public address: string = '';

  // Guardará as instâncias dos contratos para usar em qualquer tela
  public contracts: any = {
    access: null,
    registry: null,
    monitoring: null,
  };

  constructor() {}

  // Função principal de conexão com a MetaMask
  async connectWallet(): Promise<string> {
    if (!(window as any).ethereum) {
      throw new Error('MetaMask não encontrada no navegador!');
    }

    this.provider = new ethers.BrowserProvider((window as any).ethereum);
    await this.provider.send('eth_requestAccounts', []);

    this.signer = await this.provider.getSigner();
    this.address = await this.signer.getAddress();

    // Inicia os contratos com o Signer (para permitir transações)
    this.contracts.access = new ethers.Contract(ADDR.access, ABI_ACCESS, this.signer);
    this.contracts.registry = new ethers.Contract(ADDR.registry, ABI_REGISTRY, this.signer);

    return this.address;
  }

  async checkConnection(): Promise<string | null> {
    if (!(window as any).ethereum) {
      return null; // Se não tem MetaMask, não faz nada
    }

    this.provider = new ethers.BrowserProvider((window as any).ethereum);

    // Pede as contas conectadas SEM abrir o pop-up
    const accounts = await this.provider.send('eth_accounts', []);

    
    if (accounts && accounts.length > 0) {
      // Se tiver conta, configura o signer e os contratos automaticamente
      this.signer = await this.provider.getSigner();
      this.address = await this.signer.getAddress();

      this.contracts.access = new ethers.Contract(ADDR.access, ABI_ACCESS, this.signer);
      this.contracts.registry = new ethers.Contract(ADDR.registry, ABI_REGISTRY, this.signer);
      this.contracts.monitoring = new ethers.Contract(ADDR.monitoring, ABI_MONITORING, this.signer);

      return this.address;
    }

    return null; // Ninguém logado ainda
  }
}
