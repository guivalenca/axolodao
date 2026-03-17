// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./AxoloAccess.sol";
import "./AxoloRegistry.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/// @title AxoloMonitoring
/// @notice Registra e valida medições ambientais dos tanques.
///         Deve ser implantado APÓS AxoloAccess e AxoloRegistry.
///
/// @dev Herda ERC2771Context para suporte a gasless transactions via relayer próprio.
///      Passar o mesmo forwarder (RELAYER_WALLET) usado nos outros contratos.
contract AxoloMonitoring is ERC2771Context {

    // ─── Controle de Acesso ───────────────────────────────────────────────

    AxoloAccess   public accessControl;
    AxoloRegistry public registry;

    bytes32 public constant CARETAKER_ROLE = keccak256("CARETAKER_ROLE");
    bytes32 public constant AUDITOR_ROLE   = keccak256("AUDITOR_ROLE");

    modifier onlyCaretaker() {
        require(
            accessControl.hasRole(CARETAKER_ROLE, _msgSender()),
            "AxoloMonitoring: caller is not a caretaker"
        );
        _;
    }

    modifier onlyAuditor() {
        require(
            accessControl.hasRole(AUDITOR_ROLE, _msgSender()),
            "AxoloMonitoring: caller is not an auditor"
        );
        _;
    }

    // ─── Enums ────────────────────────────────────────────────────────────

    enum MeasurementStatus { Pending, Validated, Contested }

    // ─── Structs ──────────────────────────────────────────────────────────

    struct Measurement {
        uint256 id;
        uint256 tankId;
        address recorder;
        uint256 timestamp;

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

        MeasurementStatus status;
        address validator;
        uint256 validatedAt;
        string  contestReason;
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
        uint256 lastPendingId;
        uint256 lastValidatedId;
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

    /// @param _accessControl Endereço do AxoloAccess já implantado.
    /// @param _registry      Endereço do AxoloRegistry já implantado.
    /// @param forwarder      Endereço da RELAYER_WALLET do backend AxoloDAO (ERC-2771).
    constructor(address _accessControl, address _registry, address forwarder)
        ERC2771Context(forwarder)
    {
        require(_accessControl != address(0), "AxoloMonitoring: zero address");
        require(_registry != address(0), "AxoloMonitoring: zero address");
        accessControl = AxoloAccess(_accessControl);
        registry      = AxoloRegistry(_registry);
    }

    // ─── Funções de Escrita ───────────────────────────────────────────────

    function recordMeasurement(
        MeasurementParams calldata p
    ) external onlyCaretaker returns (uint256 measurementId) {
        AxoloRegistry.Tank memory tank = registry.getTank(p.tankId);
        require(tank.active, "AxoloMonitoring: tank is not active");

        address sender = _msgSender();
        measurementId = nextMeasurementId++;

        measurements[measurementId] = Measurement({
            id:              measurementId,
            tankId:          p.tankId,
            recorder:        sender,
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

        TankStatus storage ts = tankStatus[p.tankId];
        ts.lastPendingId = measurementId;
        ts.totalMeasurements++;

        emit MeasurementRecorded(measurementId, p.tankId, sender, block.timestamp);
    }

    function validateMeasurement(uint256 measurementId) external onlyAuditor {
        address sender = _msgSender();
        Measurement storage m = measurements[measurementId];
        require(m.id != 0, "AxoloMonitoring: measurement does not exist");
        require(m.status == MeasurementStatus.Pending, "AxoloMonitoring: not pending");
        require(m.recorder != sender, "AxoloMonitoring: auditor cannot validate own record");

        m.status      = MeasurementStatus.Validated;
        m.validator   = sender;
        m.validatedAt = block.timestamp;

        TankStatus storage ts = tankStatus[m.tankId];
        if (measurementId > ts.lastValidatedId) {
            ts.lastValidatedId = measurementId;
        }

        emit MeasurementValidated(measurementId, m.tankId, sender, block.timestamp);
    }

    function contestMeasurement(
        uint256 measurementId,
        string calldata reason
    ) external onlyAuditor {
        require(bytes(reason).length > 0, "AxoloMonitoring: reason cannot be empty");

        address sender = _msgSender();
        Measurement storage m = measurements[measurementId];
        require(m.id != 0, "AxoloMonitoring: measurement does not exist");
        require(m.status == MeasurementStatus.Pending, "AxoloMonitoring: not pending");
        require(m.recorder != sender, "AxoloMonitoring: auditor cannot contest own record");

        m.status        = MeasurementStatus.Contested;
        m.contestReason = reason;
        m.validator     = sender;
        m.validatedAt   = block.timestamp;

        emit MeasurementContested(measurementId, m.tankId, sender, reason);
    }

    // ─── Funções de Leitura ───────────────────────────────────────────────

    function getMeasurement(uint256 measurementId) external view returns (Measurement memory) {
        require(measurements[measurementId].id != 0, "AxoloMonitoring: measurement does not exist");
        return measurements[measurementId];
    }

    function getTankStatus(uint256 tankId) external view returns (TankStatus memory) {
        return tankStatus[tankId];
    }

    function getLastValidatedMeasurement(uint256 tankId) external view returns (Measurement memory) {
        uint256 lastId = tankStatus[tankId].lastValidatedId;
        require(lastId != 0, "AxoloMonitoring: no validated measurement for this tank");
        return measurements[lastId];
    }

    function measurementCount() external view returns (uint256) {
        return nextMeasurementId - 1;
    }
}
