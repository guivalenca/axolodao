// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./AxoloAccess.sol";

/// @title AxoloRegistry
/// @notice Registro de axolotls e tanques. Deve ser implantado APÓS AxoloAccess.
contract AxoloRegistry {

    AxoloAccess public accessControl;

    // REGISTRAR_ROLE removido — registro agora requer CARETAKER_ROLE
    bytes32 public constant CARETAKER_ROLE = keccak256("CARETAKER_ROLE");

    // Apenas endereços com CARETAKER_ROLE podem chamar funções de escrita
    modifier onlyCaretaker() {
        require(
            accessControl.hasRole(CARETAKER_ROLE, msg.sender),
            "AxoloRegistry: caller is not a caretaker"
        );
        _;
    }

    // ─── Structs ──────────────────────────────────────────────────────────

    struct Axolotl {
        uint256 id;
        string  name;
        string  species;
        uint256 birthDate;    // Unix timestamp
        uint256 tankId;
        string  morphData;    // Texto curto (comprimento, peso, cor)
        bytes32 photoHash;    // IPFS CID
        address registeredBy;
        uint256 registeredAt; // block.timestamp
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

    // IDs começam em 1; 0 é sentinela de "não definido"
    // R7: IDs sequenciais garantem rastreabilidade sem manipulação manual
    uint256 public nextAxolotlId = 1;
    uint256 public nextTankId    = 1;

    mapping(uint256 => Axolotl)    public axolotls;
    mapping(uint256 => Tank)       public tanks;
    mapping(uint256 => uint256[])  public tankAxolotls; // tankId → lista de axolotlIds

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

    // Vincula o contrato ao AxoloAccess já implantado
    constructor(address _accessControl) {
        require(_accessControl != address(0), "AxoloRegistry: zero address");
        accessControl = AxoloAccess(_accessControl);
    }

    // ─── Funções de Tanque ────────────────────────────────────────────────

    // Cria um novo tanque e retorna seu ID
    function registerTank(
        string calldata name,
        string calldata location
    ) external onlyCaretaker returns (uint256 tankId) {
        require(bytes(name).length > 0, "AxoloRegistry: name cannot be empty");
        tankId = nextTankId++;
        tanks[tankId] = Tank({
            id:           tankId,
            name:         name,
            location:     location,
            registeredBy: msg.sender,
            registeredAt: block.timestamp,
            active:       true
        });
        emit TankRegistered(tankId, msg.sender, name, location);
    }

    // Atualiza nome e localização de um tanque existente
    function updateTank(
        uint256 tankId,
        string calldata newName,
        string calldata newLocation
    ) external onlyCaretaker {
        require(tanks[tankId].id != 0, "AxoloRegistry: tank does not exist");
        require(tanks[tankId].active, "AxoloRegistry: tank is not active");
        tanks[tankId].name     = newName;
        tanks[tankId].location = newLocation;
        emit TankUpdated(tankId, msg.sender, newName, newLocation);
    }

    // Desativa um tanque; exige que todos os axolotls dentro já estejam inativos
    // R7: Apenas alteração de status para inativo; exclusão física é proibida para preservar o histórico
    function deactivateTank(uint256 tankId) external onlyCaretaker {
        require(tanks[tankId].id != 0, "AxoloRegistry: tank does not exist");
        require(tanks[tankId].active, "AxoloRegistry: tank already inactive");
        uint256[] storage ids = tankAxolotls[tankId];
        for (uint256 i = 0; i < ids.length; i++) {
            require(!axolotls[ids[i]].active, "AxoloRegistry: tank has active axolotls");
        }
        tanks[tankId].active = false;
        emit TankDeactivated(tankId, msg.sender);
    }

    // ─── Funções de Axolotl ───────────────────────────────────────────────

    // Cria um novo axolotl em um tanque e retorna seu ID
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

        axolotlId = nextAxolotlId++;
        axolotls[axolotlId] = Axolotl({
            id:           axolotlId,
            name:         name,
            species:      species,
            birthDate:    birthDate,
            tankId:       tankId,
            morphData:    morphData,
            photoHash:    photoHash,
            registeredBy: msg.sender,
            registeredAt: block.timestamp,
            active:       true
        });
        tankAxolotls[tankId].push(axolotlId); // indexa o axolotl no tanque
        emit AxolotlRegistered(axolotlId, tankId, msg.sender, name, species, birthDate);
    }

    // Atualiza nome, morphData e photoHash;
    // R7: Dados biológicos como 'species' e 'birthDate' são imutáveis após o registro
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
        emit AxolotlUpdated(axolotlId, msg.sender, newName, newMorphData, newPhotoHash);
    }

    // Move um axolotl para outro tanque; usa swap-and-pop para remover do array antigo
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

    // Desativa um axolotl permanentemente
    function deactivateAxolotl(uint256 axolotlId) external onlyCaretaker {
        require(axolotls[axolotlId].id != 0, "AxoloRegistry: axolotl does not exist");
        require(axolotls[axolotlId].active, "AxoloRegistry: axolotl already inactive");
        axolotls[axolotlId].active = false;
        emit AxolotlDeactivated(axolotlId, msg.sender);
    }

    // ─── Funções de Leitura ───────────────────────────────────────────────

    // Retorna os dados completos de um axolotl
    function getAxolotl(uint256 axolotlId) external view returns (Axolotl memory) {
        require(axolotls[axolotlId].id != 0, "AxoloRegistry: axolotl does not exist");
        return axolotls[axolotlId];
    }

    // Retorna os dados completos de um tanque
    function getTank(uint256 tankId) external view returns (Tank memory) {
        require(tanks[tankId].id != 0, "AxoloRegistry: tank does not exist");
        return tanks[tankId];
    }

    // Retorna a lista de IDs dos axolotls em um tanque
    function getAxolotlsInTank(uint256 tankId) external view returns (uint256[] memory) {
        return tankAxolotls[tankId];
    }

    // Retorna o total de axolotls registrados
    function axolotlCount() external view returns (uint256) {
        return nextAxolotlId - 1;
    }

    // Retorna o total de tanques registrados
    function tankCount() external view returns (uint256) {
        return nextTankId - 1;
    }
}
