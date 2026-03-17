// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./AxoloAccess.sol";
import "./AxoloRegistry.sol";

/// @title AxoloMonitoring
/// @notice Registra e valida medições ambientais dos tanques.
///         Deve ser implantado APÓS AxoloAccess e AxoloRegistry.
contract AxoloMonitoring {

    // ─── Controle de Acesso ───────────────────────────────────────────────

    AxoloAccess   public accessControl;
    AxoloRegistry public registry;

    bytes32 public constant CARETAKER_ROLE = keccak256("CARETAKER_ROLE");
    bytes32 public constant AUDITOR_ROLE   = keccak256("AUDITOR_ROLE");

    modifier onlyCaretaker() {
        require(
            accessControl.hasRole(CARETAKER_ROLE, msg.sender),
            "AxoloMonitoring: caller is not a caretaker"
        );
        _;
    }

    modifier onlyAuditor() {
        require(
            accessControl.hasRole(AUDITOR_ROLE, msg.sender),
            "AxoloMonitoring: caller is not an auditor"
        );
        _;
    }

    // ─── Enums ────────────────────────────────────────────────────────────

    // R9: Estados formais que distinguem dado operacional de evidência pública
    enum MeasurementStatus { Pending, Validated, Contested }

    // ─── Structs ──────────────────────────────────────────────────────────

    // Os 10 campos uint16 (20 bytes) + status uint8 (1 byte) cabem em um único slot de 32 bytes.
    // Não inserir tipos mais largos entre eles.
    struct Measurement {
        uint256 id;
        uint256 tankId;
        address recorder;
        uint256 timestamp;

        // Parâmetros ambientais armazenados como inteiros × 100
        uint16 temperature;
        uint16 ph;
        uint16 dissolvedOxygen;
        uint16 conductivity;
        uint16 turbidity;
        uint16 phosphates;
        uint16 no2;
        uint16 no3;
        uint16 ammonia;
        uint16 hardness;

        MeasurementStatus status;   // uint8 — empacota no mesmo slot do bloco uint16 acima
        address validator;          // address(0) enquanto Pending
        uint256 validatedAt;        // 0 enquanto Pending
        string  contestReason;      // "" a menos que Contested
    }

    struct MeasurementParams {
        uint256 tankId;
        uint16  temperature;
        uint16  ph;
        uint16  dissolvedOxygen;
        uint16  conductivity;
        uint16  turbidity;
        uint16  phosphates;
        uint16  no2;
        uint16  no3;
        uint16  ammonia;
        uint16  hardness;
    }

    struct TankStatus {
        uint256 lastPendingId;    // ID da medição Pending mais recente
        uint256 lastValidatedId;  // Avança apenas para IDs mais altos (monotônico)
        uint256 totalMeasurements;
    }

    // ─── Estado ───────────────────────────────────────────────────────────

    uint256 public nextMeasurementId = 1;

    mapping(uint256 => Measurement) public measurements;
    mapping(uint256 => TankStatus)  public tankStatus;

    // ─── Eventos ──────────────────────────────────────────────────────────

    event MeasurementRecorded(
        uint256 indexed measurementId,
        uint256 indexed tankId,
        address indexed recorder,
        uint256 timestamp
    );

    event MeasurementValidated(
        uint256 indexed measurementId,
        uint256 indexed tankId,
        address indexed validator,
        uint256 timestamp
    );

    event MeasurementContested(
        uint256 indexed measurementId,
        uint256 indexed tankId,
        address indexed validator,
        string reason
    );

    // ─── Construtor ───────────────────────────────────────────────────────

    // Vincula os contratos de acesso e registro já implantados
    constructor(address _accessControl, address _registry) {
        require(_accessControl != address(0), "AxoloMonitoring: zero address");
        require(_registry != address(0), "AxoloMonitoring: zero address");
        accessControl = AxoloAccess(_accessControl);
        registry      = AxoloRegistry(_registry);
    }

    // ─── Funções de Escrita ───────────────────────────────────────────────

    // Registra uma nova medição ambiental para um tanque ativo
    // R1 e R5: Registro por cuidador autorizado com timestamp automático do sistema
    function recordMeasurement(
        MeasurementParams calldata p
    ) external onlyCaretaker returns (uint256 measurementId) {
        AxoloRegistry.Tank memory tank = registry.getTank(p.tankId);
        require(tank.active, "AxoloMonitoring: tank is not active");

        measurementId = nextMeasurementId++;

        measurements[measurementId] = Measurement({
            id:              measurementId,
            tankId:          p.tankId,
            recorder:        msg.sender,
            timestamp:       block.timestamp,
            temperature:     p.temperature,
            ph:              p.ph,
            dissolvedOxygen: p.dissolvedOxygen,
            conductivity:    p.conductivity,
            turbidity:       p.turbidity,
            phosphates:      p.phosphates,
            no2:             p.no2,
            no3:             p.no3,
            ammonia:         p.ammonia,
            hardness:        p.hardness,
            status:          MeasurementStatus.Pending,
            validator:       address(0),
            validatedAt:     0,
            contestReason:   ""
        });

        // Novas medições sempre têm o ID mais alto, então lastPendingId é atualizado incondicionalmente
        TankStatus storage ts = tankStatus[p.tankId];
        ts.lastPendingId = measurementId;
        ts.totalMeasurements++;

        emit MeasurementRecorded(measurementId, p.tankId, msg.sender, block.timestamp);
    }

    // Aprova uma medição Pending
    // R2 e R4: Auditor valida o dado; sistema bloqueia auto-validação para evitar conflito de interesse
    function validateMeasurement(uint256 measurementId) external onlyAuditor {
        Measurement storage m = measurements[measurementId];
        require(m.id != 0, "AxoloMonitoring: measurement does not exist");
        require(m.status == MeasurementStatus.Pending, "AxoloMonitoring: not pending");
        require(m.recorder != msg.sender, "AxoloMonitoring: auditor cannot validate own record");

        m.status      = MeasurementStatus.Validated;
        m.validator   = msg.sender;
        m.validatedAt = block.timestamp;

        // Ponteiro monotônico: só avança para IDs mais altos, independente da ordem de processamento
        TankStatus storage ts = tankStatus[m.tankId];
        if (measurementId > ts.lastValidatedId) {
            ts.lastValidatedId = measurementId;
        }

        emit MeasurementValidated(measurementId, m.tankId, msg.sender, block.timestamp);
    }

    // Marca uma medição Pending como contestada com um motivo obrigatório
    function contestMeasurement(
        uint256 measurementId,
        string calldata reason
    ) external onlyAuditor {
        require(bytes(reason).length > 0, "AxoloMonitoring: reason cannot be empty");

        Measurement storage m = measurements[measurementId];
        require(m.id != 0, "AxoloMonitoring: measurement does not exist");
        require(m.status == MeasurementStatus.Pending, "AxoloMonitoring: not pending");
        require(m.recorder != msg.sender, "AxoloMonitoring: auditor cannot contest own record");

        m.status        = MeasurementStatus.Contested;
        m.contestReason = reason;
        m.validator     = msg.sender;
        m.validatedAt   = block.timestamp;
        // Ponteiros NÃO são atualizados em contestações — não afeta o estado positivo do tanque

        emit MeasurementContested(measurementId, m.tankId, msg.sender, reason);
    }

    // ─── Funções de Leitura ───────────────────────────────────────────────

    // Retorna os dados completos de uma medição
    function getMeasurement(uint256 measurementId) external view returns (Measurement memory) {
        require(measurements[measurementId].id != 0, "AxoloMonitoring: measurement does not exist");
        return measurements[measurementId];
    }

    // Retorna os contadores e ponteiros de status de um tanque
    function getTankStatus(uint256 tankId) external view returns (TankStatus memory) {
        return tankStatus[tankId];
    }

    // Retorna a medição validada mais recente de um tanque
    // R3: Interface pública
    function getLastValidatedMeasurement(uint256 tankId) external view returns (Measurement memory) {
        uint256 lastId = tankStatus[tankId].lastValidatedId;
        require(lastId != 0, "AxoloMonitoring: no validated measurement for this tank");
        return measurements[lastId];
    }

    // Retorna o total de medições registradas
    function measurementCount() external view returns (uint256) {
        return nextMeasurementId - 1;
    }
}
