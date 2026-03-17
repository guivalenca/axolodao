// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./AxoloAccess.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/// @title AxoloRegistry
/// @notice Registro de axolotls e tanques. Deve ser implantado APÓS AxoloAccess.
///
/// @dev Herda ERC2771Context para suporte a gasless transactions via relayer próprio.
///      Passar o mesmo forwarder (RELAYER_WALLET) usado no AxoloAccess.
contract AxoloRegistry is ERC2771Context {

    AxoloAccess public accessControl;

    bytes32 public constant CARETAKER_ROLE = keccak256("CARETAKER_ROLE");

    modifier onlyCaretaker() {
        require(
            accessControl.hasRole(CARETAKER_ROLE, _msgSender()),
            "AxoloRegistry: caller is not a caretaker"
        );
        _;
    }

    // ─── Structs ──────────────────────────────────────────────────────────

    struct Axolotl {
        uint256 id;
        string  name;
        string  species;
        uint256 birthDate;
        uint256 tankId;
        string  morphData;
        bytes32 photoHash;
        address registeredBy;
        uint256 registeredAt;
        bool    active;
    }

    struct Tank {
        uint256 id;
        string  name;
        string  location;
        address registeredBy;
        uint256 registeredAt;
        bool    active;
    }

    // ─── Estado ───────────────────────────────────────────────────────────

    uint256 public nextAxolotlId = 1;
    uint256 public nextTankId    = 1;

    mapping(uint256 => Axolotl)    public axolotls;
    mapping(uint256 => Tank)       public tanks;
    mapping(uint256 => uint256[])  public tankAxolotls;

    // ─── Eventos ──────────────────────────────────────────────────────────

    event TankRegistered(
        uint256 indexed tankId,
        address indexed registeredBy,
        string name,
        string location
    );

    event TankUpdated(
        uint256 indexed tankId,
        address indexed updatedBy,
        string newName,
        string newLocation
    );

    event TankDeactivated(
        uint256 indexed tankId,
        address indexed by
    );

    event AxolotlRegistered(
        uint256 indexed axolotlId,
        uint256 indexed tankId,
        address indexed registeredBy,
        string name,
        string species,
        uint256 birthDate
    );

    event AxolotlUpdated(
        uint256 indexed axolotlId,
        address indexed updatedBy,
        string newName,
        string newMorphData,
        bytes32 newPhotoHash
    );

    event AxolotlTransferred(
        uint256 indexed axolotlId,
        uint256 indexed fromTankId,
        uint256 indexed toTankId
    );

    event AxolotlDeactivated(
        uint256 indexed axolotlId,
        address indexed by
    );

    // ─── Construtor ───────────────────────────────────────────────────────

    /// @param _accessControl Endereço do AxoloAccess já implantado.
    /// @param forwarder      Endereço da RELAYER_WALLET do backend AxoloDAO (ERC-2771).
    constructor(address _accessControl, address forwarder) ERC2771Context(forwarder) {
        require(_accessControl != address(0), "AxoloRegistry: zero address");
        accessControl = AxoloAccess(_accessControl);
    }

    // ─── Funções de Tanque ────────────────────────────────────────────────

    function registerTank(
        string calldata name,
        string calldata location
    ) external onlyCaretaker returns (uint256 tankId) {
        require(bytes(name).length > 0, "AxoloRegistry: name cannot be empty");
        address sender = _msgSender();
        tankId = nextTankId++;
        tanks[tankId] = Tank({
            id:           tankId,
            name:         name,
            location:     location,
            registeredBy: sender,
            registeredAt: block.timestamp,
            active:       true
        });
        emit TankRegistered(tankId, sender, name, location);
    }

    function updateTank(
        uint256 tankId,
        string calldata newName,
        string calldata newLocation
    ) external onlyCaretaker {
        require(tanks[tankId].id != 0, "AxoloRegistry: tank does not exist");
        require(tanks[tankId].active, "AxoloRegistry: tank is not active");
        tanks[tankId].name     = newName;
        tanks[tankId].location = newLocation;
        emit TankUpdated(tankId, _msgSender(), newName, newLocation);
    }

    function deactivateTank(uint256 tankId) external onlyCaretaker {
        require(tanks[tankId].id != 0, "AxoloRegistry: tank does not exist");
        require(tanks[tankId].active, "AxoloRegistry: tank already inactive");
        uint256[] storage ids = tankAxolotls[tankId];
        for (uint256 i = 0; i < ids.length; i++) {
            require(!axolotls[ids[i]].active, "AxoloRegistry: tank has active axolotls");
        }
        tanks[tankId].active = false;
        emit TankDeactivated(tankId, _msgSender());
    }

    // ─── Funções de Axolotl ───────────────────────────────────────────────

    function registerAxolotl(
        string  calldata name,
        string  calldata species,
        uint256 birthDate,
        uint256 tankId,
        string  calldata morphData,
        bytes32 photoHash
    ) external onlyCaretaker returns (uint256 axolotlId) {
        require(tanks[tankId].id != 0, "AxoloRegistry: tank does not exist");
        require(tanks[tankId].active, "AxoloRegistry: tank is not active");
        require(bytes(name).length > 0, "AxoloRegistry: name cannot be empty");
        require(bytes(species).length > 0, "AxoloRegistry: species cannot be empty");
        require(bytes(morphData).length > 0, "AxoloRegistry: morphData cannot be empty");
        require(birthDate > 0, "AxoloRegistry: birthDate cannot be zero");
        require(photoHash != bytes32(0), "AxoloRegistry: photoHash cannot be zero");

        address sender = _msgSender();
        axolotlId = nextAxolotlId++;
        axolotls[axolotlId] = Axolotl({
            id:           axolotlId,
            name:         name,
            species:      species,
            birthDate:    birthDate,
            tankId:       tankId,
            morphData:    morphData,
            photoHash:    photoHash,
            registeredBy: sender,
            registeredAt: block.timestamp,
            active:       true
        });
        tankAxolotls[tankId].push(axolotlId);
        emit AxolotlRegistered(axolotlId, tankId, sender, name, species, birthDate);
    }

    function updateAxolotl(
        uint256  axolotlId,
        string  calldata newName,
        string  calldata newMorphData,
        bytes32 newPhotoHash
    ) external onlyCaretaker {
        require(axolotls[axolotlId].id != 0, "AxoloRegistry: axolotl does not exist");
        require(axolotls[axolotlId].active, "AxoloRegistry: axolotl is not active");
        axolotls[axolotlId].name      = newName;
        axolotls[axolotlId].morphData = newMorphData;
        axolotls[axolotlId].photoHash = newPhotoHash;
        emit AxolotlUpdated(axolotlId, _msgSender(), newName, newMorphData, newPhotoHash);
    }

    function transferAxolotl(uint256 axolotlId, uint256 newTankId) external onlyCaretaker {
        require(axolotls[axolotlId].id != 0, "AxoloRegistry: axolotl does not exist");
        require(axolotls[axolotlId].active, "AxoloRegistry: axolotl is not active");
        require(tanks[newTankId].id != 0, "AxoloRegistry: destination tank does not exist");
        require(tanks[newTankId].active, "AxoloRegistry: destination tank is not active");

        uint256 fromTankId = axolotls[axolotlId].tankId;
        require(fromTankId != newTankId, "AxoloRegistry: same tank");

        uint256[] storage oldList = tankAxolotls[fromTankId];
        for (uint256 i = 0; i < oldList.length; i++) {
            if (oldList[i] == axolotlId) {
                oldList[i] = oldList[oldList.length - 1];
                oldList.pop();
                break;
            }
        }

        tankAxolotls[newTankId].push(axolotlId);
        axolotls[axolotlId].tankId = newTankId;

        emit AxolotlTransferred(axolotlId, fromTankId, newTankId);
    }

    function deactivateAxolotl(uint256 axolotlId) external onlyCaretaker {
        require(axolotls[axolotlId].id != 0, "AxoloRegistry: axolotl does not exist");
        require(axolotls[axolotlId].active, "AxoloRegistry: axolotl already inactive");
        axolotls[axolotlId].active = false;
        emit AxolotlDeactivated(axolotlId, _msgSender());
    }

    // ─── Funções de Leitura ───────────────────────────────────────────────

    function getAxolotl(uint256 axolotlId) external view returns (Axolotl memory) {
        require(axolotls[axolotlId].id != 0, "AxoloRegistry: axolotl does not exist");
        return axolotls[axolotlId];
    }

    function getTank(uint256 tankId) external view returns (Tank memory) {
        require(tanks[tankId].id != 0, "AxoloRegistry: tank does not exist");
        return tanks[tankId];
    }

    function getAxolotlsInTank(uint256 tankId) external view returns (uint256[] memory) {
        return tankAxolotls[tankId];
    }

    function axolotlCount() external view returns (uint256) {
        return nextAxolotlId - 1;
    }

    function tankCount() external view returns (uint256) {
        return nextTankId - 1;
    }
}
