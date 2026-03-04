// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AxoloAccess
/// @notice Controle de acesso central baseado em funções para o sistema AxoloDAO.
/// Herda o AccessControl v5 da OpenZeppelin.
/// Deve ser implantado PRIMEIRO.
contract AxoloAccess is AccessControl {

    // R1: Papel para a Persona Ana. Garante vínculo institucional para registros 
    bytes32 public constant CARETAKER_ROLE = keccak256("CARETAKER_ROLE");

    // R2: Papel para a Persona Ricardo. Autoridade científica para validação e auditoria [1,
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    // R7: Papel responsável pela gestão da identidade imutável de exemplares e tanques
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    /// @notice Concede o DEFAULT_ADMIN_ROLE ao implantador (deployer).
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // DEFAULT_ADMIN_ROLE é o administrador de todas as funções por padrão no AccessControl da OZ.
    }

    // hasRole(), getRoleAdmin(), grantRole(), revokeRole() são todos herdados da OZ.
    // Os eventos RoleGranted e RoleRevoked são emitidos internamente pela OZ.
}
