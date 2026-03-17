// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IENSRegistry {
    function resolver(bytes32 node) external view returns (address);
}

interface IENSResolver {
    function addr(bytes32 node) external view returns (address);
}

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AxoloAccess
/// @notice Controle de acesso central do AxoloDAO com verificação de identidade via ENS.
/// Qualquer endereço que possua um subdomínio de uma instituição reconhecida pode
/// registrar seu próprio acesso chamando `registrarAcesso`. Nenhuma ação do admin
/// é necessária por usuário — apenas a criação do subdomínio ENS.
contract AxoloAccess is AccessControl {

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    bytes32 public constant CARETAKER_ROLE = keccak256("CARETAKER_ROLE");
    bytes32 public constant AUDITOR_ROLE   = keccak256("AUDITOR_ROLE");
    // REGISTRAR_ROLE removido — registro de tanques e axolotes agora requer CARETAKER_ROLE

    // -------------------------------------------------------------------------
    // ENS
    // -------------------------------------------------------------------------

    /// @notice Endereço do ENS Registry — igual na Sepolia e no mainnet.
    address public constant ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;

    /// @notice namehash("biomuseu.axolodao.eth") — calculado no constructor.
    /// Qualquer subdomínio deste nó recebe CARETAKER_ROLE.
    bytes32 public immutable CARETAKER_DOMAIN;

    /// @notice namehash("unam.axolodao.eth") — calculado no constructor.
    /// Qualquer subdomínio deste nó recebe AUDITOR_ROLE.
    bytes32 public immutable AUDITOR_DOMAIN;

    // -------------------------------------------------------------------------
    // Rastreabilidade
    // -------------------------------------------------------------------------

    /// @notice ENS name associado a cada endereço que registrou acesso.
    mapping(address => string) public ensName;

    // -------------------------------------------------------------------------
    // Eventos
    // -------------------------------------------------------------------------

    event AcessoRegistrado(
        bytes32 indexed role,
        address indexed account,
        string  label,
        bytes32 indexed parentNode
    );

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Calcula namehash("biomuseu.axolodao.eth") usando keccak256 nativo do EVM.
        // namehash é acumulativo da direita para a esquerda:
        //   node_0   = 0x00...00
        //   node_eth = keccak256(node_0      || keccak256("eth"))
        //   node_dao = keccak256(node_eth    || keccak256("axolodao"))
        //   node_bio = keccak256(node_dao    || keccak256("biomuseu"))
        //   node_una = keccak256(node_dao    || keccak256("unam"))

        bytes32 node = bytes32(0);
        node = keccak256(abi.encodePacked(node, keccak256(bytes("eth"))));
        node = keccak256(abi.encodePacked(node, keccak256(bytes("axolodao"))));

        bytes32 axolodaoNode = node;
        CARETAKER_DOMAIN = keccak256(abi.encodePacked(axolodaoNode, keccak256(bytes("biomuseu"))));
        AUDITOR_DOMAIN   = keccak256(abi.encodePacked(axolodaoNode, keccak256(bytes("unam"))));
    }

    // -------------------------------------------------------------------------
    // Função principal — registro de acesso via ENS
    // -------------------------------------------------------------------------

    /// @notice Qualquer pessoa com um subdomínio institucional válido pode chamar
    /// esta função para registrar seu próprio acesso.
    ///
    /// @param label       O label pessoal do ENS name. Ex: "ana"
    /// @param parentNode  O namehash do domínio institucional pai.
    ///                    Ex: namehash("biomuseu.axolodao.eth") = CARETAKER_DOMAIN
    ///                    Calculado pelo frontend via ethers.js: ethers.namehash("biomuseu.axolodao.eth")
    ///
    /// @dev O contrato:
    ///      1. Reconstrói o node completo: keccak256(parentNode || keccak256(label))
    ///      2. Consulta o ENS Registry para obter o Resolver
    ///      3. Consulta o Resolver para obter o endereço resolvido
    ///      4. Verifica que o endereço resolvido == msg.sender
    ///      5. Verifica que parentNode é CARETAKER_DOMAIN ou AUDITOR_DOMAIN
    ///      6. Concede o role correspondente
    function registrarAcesso(string calldata label, bytes32 parentNode) external {
        // 1. Reconstrói o namehash completo do nome pessoal
        bytes32 node = keccak256(
            abi.encodePacked(parentNode, keccak256(bytes(label)))
        );

        // 2. Obtém o Resolver do ENS Registry
        address resolverAddr = IENSRegistry(ENS_REGISTRY).resolver(node);
        require(resolverAddr != address(0), "ENS: resolver nao configurado para este nome");

        // 3. Resolve o endereço
        address resolvedAddr = IENSResolver(resolverAddr).addr(node);
        require(resolvedAddr != address(0), "ENS: endereco nao configurado para este nome");

        // 4. Garante que quem chama é o dono do nome ENS
        require(resolvedAddr == msg.sender, "ENS: endereco nao corresponde ao msg.sender");

        // 5 & 6. Determina e concede o role com base no domínio pai
        bytes32 role;
        if (parentNode == CARETAKER_DOMAIN) {
            role = CARETAKER_ROLE;
        } else if (parentNode == AUDITOR_DOMAIN) {
            role = AUDITOR_ROLE;
        } else {
            revert("ENS: dominio pai nao e uma instituicao reconhecida");
        }

        _grantRole(role, msg.sender);

        // 7. Rastreabilidade: guarda o ENS name completo
        ensName[msg.sender] = string(abi.encodePacked(label, ".", _nodeToLabel(parentNode), ".axolodao.eth"));

        emit AcessoRegistrado(role, msg.sender, label, parentNode);
    }

    // -------------------------------------------------------------------------
    // Helpers internos
    // -------------------------------------------------------------------------

    /// @dev Retorna o label textual do domínio institucional para rastreabilidade.
    function _nodeToLabel(bytes32 node) internal view returns (string memory) {
        if (node == CARETAKER_DOMAIN) return "biomuseu";
        if (node == AUDITOR_DOMAIN)   return "unam";
        return "desconhecido";
    }

    // -------------------------------------------------------------------------
    // Herdado da OpenZeppelin — mantido intacto
    // hasRole(), grantRole(), revokeRole(), getRoleAdmin()
    // -------------------------------------------------------------------------
}
