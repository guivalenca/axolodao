// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IENSRegistry {
    function resolver(bytes32 node) external view returns (address);
}

interface IENSResolver {
    function addr(bytes32 node) external view returns (address);
}

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";

/// @title AxoloAccess
/// @notice Controle de acesso central do AxoloDAO com verificação de identidade via ENS.
/// Qualquer endereço que possua um subdomínio de uma instituição reconhecida pode
/// registrar seu próprio acesso chamando `registrarAcesso`. Nenhuma ação do admin
/// é necessária por usuário — apenas a criação do subdomínio ENS.
///
/// @dev Herda ERC2771Context para suporte a gasless transactions via relayer próprio.
///      O trustedForwarder é o endereço da RELAYER_WALLET do backend AxoloDAO.
contract AxoloAccess is AccessControl, ERC2771Context {

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    bytes32 public constant CARETAKER_ROLE = keccak256("CARETAKER_ROLE");
    bytes32 public constant AUDITOR_ROLE   = keccak256("AUDITOR_ROLE");

    // -------------------------------------------------------------------------
    // ENS
    // -------------------------------------------------------------------------

    address public constant ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;

    bytes32 public immutable CARETAKER_DOMAIN;
    bytes32 public immutable AUDITOR_DOMAIN;

    // -------------------------------------------------------------------------
    // Rastreabilidade
    // -------------------------------------------------------------------------

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

    /// @param forwarder Endereço da RELAYER_WALLET do backend AxoloDAO (ERC-2771).
    ///                  Este EOA é o único autorizado a encaminhar transações gasless.
    constructor(address forwarder) ERC2771Context(forwarder) {
        // msg.sender aqui é o deployer — chamada direta, não relayada.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

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

    function registrarAcesso(string calldata label, bytes32 parentNode) external {
        address sender = _msgSender();

        bytes32 node = keccak256(
            abi.encodePacked(parentNode, keccak256(bytes(label)))
        );

        address resolverAddr = IENSRegistry(ENS_REGISTRY).resolver(node);
        require(resolverAddr != address(0), "ENS: resolver nao configurado para este nome");

        address resolvedAddr = IENSResolver(resolverAddr).addr(node);
        require(resolvedAddr != address(0), "ENS: endereco nao configurado para este nome");

        require(resolvedAddr == sender, "ENS: endereco nao corresponde ao msg.sender");

        bytes32 role;
        if (parentNode == CARETAKER_DOMAIN) {
            role = CARETAKER_ROLE;
        } else if (parentNode == AUDITOR_DOMAIN) {
            role = AUDITOR_ROLE;
        } else {
            revert("ENS: dominio pai nao e uma instituicao reconhecida");
        }

        _grantRole(role, sender);

        ensName[sender] = string(abi.encodePacked(label, ".", _nodeToLabel(parentNode), ".axolodao.eth"));

        emit AcessoRegistrado(role, sender, label, parentNode);
    }

    // -------------------------------------------------------------------------
    // Helpers internos
    // -------------------------------------------------------------------------

    function _nodeToLabel(bytes32 node) internal view returns (string memory) {
        if (node == CARETAKER_DOMAIN) return "biomuseu";
        if (node == AUDITOR_DOMAIN)   return "unam";
        return "desconhecido";
    }

    // -------------------------------------------------------------------------
    // Overrides obrigatórios — resolvem ambiguidade de herança múltipla
    // entre AccessControl (herda Context) e ERC2771Context (herda Context)
    // -------------------------------------------------------------------------

    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}
