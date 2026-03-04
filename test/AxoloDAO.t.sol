// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AxoloAccess.sol";
import "../src/AxoloRegistry.sol";
import "../src/AxoloMonitoring.sol";

contract AxoloDAOTest is Test {

    // ─── Contracts ────────────────────────────────────────────────────────
    AxoloAccess    access;
    AxoloRegistry  registry;
    AxoloMonitoring monitoring;

    // ─── Actors ───────────────────────────────────────────────────────────
    address admin     = makeAddr("admin");      // deployer / DEFAULT_ADMIN_ROLE
    address registrar = makeAddr("registrar");  // REGISTRAR_ROLE
    address caretaker = makeAddr("caretaker");  // CARETAKER_ROLE
    address auditor   = makeAddr("auditor");    // AUDITOR_ROLE
    address stranger  = makeAddr("stranger");   // no role

    // ─── Helpers ──────────────────────────────────────────────────────────

    // Dummy values reused across tests
    bytes32 constant PHOTO_HASH = keccak256("photo_ipfs_cid");
    uint256 constant BIRTH_DATE = 1_700_000_000;

    // A valid MeasurementParams struct (pH 7.23, temp 18.5°C, etc.)
    function _params(uint256 tankId)
        internal pure returns (AxoloMonitoring.MeasurementParams memory)
    {
        return AxoloMonitoring.MeasurementParams({
            tankId:          tankId,
            temperature:     1850,   // 18.50 °C
            ph:              723,    // 7.23
            dissolvedOxygen: 850,    // 8.50 mg/L
            conductivity:    30000,  // 300.00 μS/cm
            turbidity:       50,     // 0.50 NTU
            phosphates:      25,     // 0.25 mg/L
            no2:             10,     // 0.10 mg/L
            no3:             400,    // 4.00 mg/L
            ammonia:         5,      // 0.05 mg/L
            hardness:        18000   // 180.00 mg/L
        });
    }

    // Registers tank 1 and axolotl 1 as the registrar — used in most tests.
    function _setupTankAndAxolotl() internal returns (uint256 tankId, uint256 axolotlId) {
        vm.startPrank(registrar);
        tankId = registry.registerTank("Tanque Principal", "Sala B");
        axolotlId = registry.registerAxolotl(
            "Xolotl",
            "Ambystoma mexicanum",
            BIRTH_DATE,
            tankId,
            "20cm, 80g, leucistico",
            PHOTO_HASH
        );
        vm.stopPrank();
    }

    // ─── Setup ────────────────────────────────────────────────────────────

    function setUp() public {
        // Deploy all three contracts as `admin`
        vm.startPrank(admin);

        access     = new AxoloAccess();
        registry   = new AxoloRegistry(address(access));
        monitoring = new AxoloMonitoring(address(access), address(registry));

        // Grant roles
        access.grantRole(access.REGISTRAR_ROLE(), registrar);
        access.grantRole(access.CARETAKER_ROLE(), caretaker);
        access.grantRole(access.AUDITOR_ROLE(),   auditor);

        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 1 — AxoloAccess: role management
    // ═══════════════════════════════════════════════════════════════════════

    function test_access_rolesGrantedCorrectly() public view {
        assertTrue(access.hasRole(access.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(access.hasRole(access.REGISTRAR_ROLE(),     registrar));
        assertTrue(access.hasRole(access.CARETAKER_ROLE(),     caretaker));
        assertTrue(access.hasRole(access.AUDITOR_ROLE(),       auditor));
        assertFalse(access.hasRole(access.CARETAKER_ROLE(),    stranger));
    }

    function test_access_adminCanRevokeRole() public {
        vm.startPrank(admin);
        access.revokeRole(access.CARETAKER_ROLE(), caretaker);
        vm.stopPrank();

        assertFalse(access.hasRole(access.CARETAKER_ROLE(), caretaker));
    }


    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 2 — AxoloRegistry: tanks
    // ═══════════════════════════════════════════════════════════════════════

    function test_registry_registerTank() public {
        vm.prank(registrar);
        uint256 id = registry.registerTank("Tanque 01", "Sala A");

        assertEq(id, 1);
        AxoloRegistry.Tank memory t = registry.getTank(1);
        assertEq(t.name,     "Tanque 01");
        assertEq(t.location, "Sala A");
        assertTrue(t.active);
        assertEq(t.registeredBy, registrar);
    }

    function test_registry_strangerCannotRegisterTank() public {
        vm.prank(stranger);
        vm.expectRevert("AxoloRegistry: caller is not a registrar");
        registry.registerTank("Tanque X", "Sala X");
    }

    function test_registry_caretakerCannotRegisterTank() public {
        vm.prank(caretaker);
        vm.expectRevert("AxoloRegistry: caller is not a registrar");
        registry.registerTank("Tanque X", "Sala X");
    }

    function test_registry_emptyNameReverts() public {
        vm.prank(registrar);
        vm.expectRevert("AxoloRegistry: name cannot be empty");
        registry.registerTank("", "Sala A");
    }

    function test_registry_updateTank() public {
        vm.startPrank(registrar);
        registry.registerTank("Tanque 01", "Sala A");
        registry.updateTank(1, "Tanque 01 Atualizado", "Sala B");
        vm.stopPrank();

        AxoloRegistry.Tank memory t = registry.getTank(1);
        assertEq(t.name,     "Tanque 01 Atualizado");
        assertEq(t.location, "Sala B");
    }

    function test_registry_updateNonExistentTankReverts() public {
        vm.prank(registrar);
        vm.expectRevert("AxoloRegistry: tank does not exist");
        registry.updateTank(99, "X", "Y");
    }

    function test_registry_tankCount() public {
        vm.startPrank(registrar);
        registry.registerTank("T1", "L1");
        registry.registerTank("T2", "L2");
        vm.stopPrank();
        assertEq(registry.tankCount(), 2);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 3 — AxoloRegistry: axolotls
    // ═══════════════════════════════════════════════════════════════════════

    function test_registry_registerAxolotl() public {
        (uint256 tankId, uint256 axolotlId) = _setupTankAndAxolotl();

        assertEq(axolotlId, 1);
        AxoloRegistry.Axolotl memory a = registry.getAxolotl(axolotlId);
        assertEq(a.name,      "Xolotl");
        assertEq(a.tankId,    tankId);
        assertTrue(a.active);
        assertEq(a.registeredBy, registrar);
    }

    function test_registry_axolotlAppearsInTankList() public {
        (uint256 tankId, uint256 axolotlId) = _setupTankAndAxolotl();
        uint256[] memory ids = registry.getAxolotlsInTank(tankId);
        assertEq(ids.length, 1);
        assertEq(ids[0], axolotlId);
    }

    function test_registry_registerAxolotlInNonExistentTankReverts() public {
        vm.prank(registrar);
        vm.expectRevert("AxoloRegistry: tank does not exist");
        registry.registerAxolotl(
            "Xolotl", "Ambystoma mexicanum",
            BIRTH_DATE, 99,
            "20cm", PHOTO_HASH
        );
    }

    function test_registry_registerAxolotlWithZeroBirthDateReverts() public {
        vm.prank(registrar);
        registry.registerTank("T1", "L1");

        vm.prank(registrar);
        vm.expectRevert("AxoloRegistry: birthDate cannot be zero");
        registry.registerAxolotl(
            "Xolotl", "Ambystoma mexicanum",
            0, 1,
            "20cm", PHOTO_HASH
        );
    }

    function test_registry_updateAxolotl() public {
        (, uint256 axolotlId) = _setupTankAndAxolotl();
        bytes32 newHash = keccak256("new_photo");

        vm.prank(registrar);
        registry.updateAxolotl(axolotlId, "Xolotl V2", "22cm, 90g", newHash);

        AxoloRegistry.Axolotl memory a = registry.getAxolotl(axolotlId);
        assertEq(a.name,      "Xolotl V2");
        assertEq(a.morphData, "22cm, 90g");
        assertEq(a.photoHash, newHash);
        // species is immutable — must not change
        assertEq(a.species, "Ambystoma mexicanum");
    }

    function test_registry_transferAxolotl() public {
        (uint256 tankId, uint256 axolotlId) = _setupTankAndAxolotl();

        vm.startPrank(registrar);
        uint256 tank2Id = registry.registerTank("Tanque 2", "Sala C");
        registry.transferAxolotl(axolotlId, tank2Id);
        vm.stopPrank();

        AxoloRegistry.Axolotl memory a = registry.getAxolotl(axolotlId);
        assertEq(a.tankId, tank2Id);

        // Old tank list must be empty
        uint256[] memory oldList = registry.getAxolotlsInTank(tankId);
        assertEq(oldList.length, 0);

        // New tank list must contain the axolotl
        uint256[] memory newList = registry.getAxolotlsInTank(tank2Id);
        assertEq(newList.length, 1);
        assertEq(newList[0], axolotlId);
    }

    function test_registry_transferToSameTankReverts() public {
        (uint256 tankId, uint256 axolotlId) = _setupTankAndAxolotl();

        vm.prank(registrar);
        vm.expectRevert("AxoloRegistry: same tank");
        registry.transferAxolotl(axolotlId, tankId);
    }

    function test_registry_deactivateAxolotl() public {
        (, uint256 axolotlId) = _setupTankAndAxolotl();

        vm.prank(registrar);
        registry.deactivateAxolotl(axolotlId);

        AxoloRegistry.Axolotl memory a = registry.getAxolotl(axolotlId);
        assertFalse(a.active);
    }

    function test_registry_deactivateAxolotlTwiceReverts() public {
        (, uint256 axolotlId) = _setupTankAndAxolotl();

        vm.startPrank(registrar);
        registry.deactivateAxolotl(axolotlId);
        vm.expectRevert("AxoloRegistry: axolotl already inactive");
        registry.deactivateAxolotl(axolotlId);
        vm.stopPrank();
    }

    function test_registry_cannotDeactivateTankWithActiveAxolotl() public {
        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.prank(registrar);
        vm.expectRevert("AxoloRegistry: tank has active axolotls");
        registry.deactivateTank(tankId);
    }

    function test_registry_deactivateTankAfterAxolotlDeactivated() public {
        (uint256 tankId, uint256 axolotlId) = _setupTankAndAxolotl();

        vm.startPrank(registrar);
        registry.deactivateAxolotl(axolotlId);
        registry.deactivateTank(tankId);
        vm.stopPrank();

        AxoloRegistry.Tank memory t = registry.getTank(tankId);
        assertFalse(t.active);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 4 — AxoloMonitoring: recording measurements
    // ═══════════════════════════════════════════════════════════════════════

    function test_monitoring_recordMeasurement() public {
        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.prank(caretaker);
        uint256 mId = monitoring.recordMeasurement(_params(tankId));

        assertEq(mId, 1);
        AxoloMonitoring.Measurement memory m = monitoring.getMeasurement(mId);
        assertEq(m.tankId,      tankId);
        assertEq(m.recorder,    caretaker);
        assertEq(m.temperature, 1850);
        assertEq(m.ph,          723);
        assertEq(uint8(m.status), uint8(AxoloMonitoring.MeasurementStatus.Pending));
        assertEq(m.validator,   address(0));
        assertEq(m.validatedAt, 0);
    }

    function test_monitoring_strangerCannotRecord() public {
        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.prank(stranger);
        vm.expectRevert("AxoloMonitoring: caller is not a caretaker");
        monitoring.recordMeasurement(_params(tankId));
    }

    function test_monitoring_auditorCannotRecord() public {
        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.prank(auditor);
        vm.expectRevert("AxoloMonitoring: caller is not a caretaker");
        monitoring.recordMeasurement(_params(tankId));
    }

    function test_monitoring_cannotRecordForInactiveTank() public {
        (uint256 tankId, uint256 axolotlId) = _setupTankAndAxolotl();

        vm.startPrank(registrar);
        registry.deactivateAxolotl(axolotlId);
        registry.deactivateTank(tankId);
        vm.stopPrank();

        vm.prank(caretaker);
        vm.expectRevert("AxoloMonitoring: tank is not active");
        monitoring.recordMeasurement(_params(tankId));
    }

    function test_monitoring_tankStatusUpdatedAfterRecord() public {
        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.prank(caretaker);
        monitoring.recordMeasurement(_params(tankId));

        AxoloMonitoring.TankStatus memory ts = monitoring.getTankStatus(tankId);
        assertEq(ts.lastPendingId,    1);
        assertEq(ts.totalMeasurements, 1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 5 — AxoloMonitoring: validation
    // ═══════════════════════════════════════════════════════════════════════

    function test_monitoring_validateMeasurement() public {
        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.prank(caretaker);
        uint256 mId = monitoring.recordMeasurement(_params(tankId));

        vm.prank(auditor);
        monitoring.validateMeasurement(mId);

        AxoloMonitoring.Measurement memory m = monitoring.getMeasurement(mId);
        assertEq(uint8(m.status),    uint8(AxoloMonitoring.MeasurementStatus.Validated));
        assertEq(m.validator,        auditor);
        assertGt(m.validatedAt,      0);
    }

    function test_monitoring_strangerCannotValidate() public {
        (uint256 tankId,) = _setupTankAndAxolotl();
        vm.prank(caretaker);
        uint256 mId = monitoring.recordMeasurement(_params(tankId));

        vm.prank(stranger);
        vm.expectRevert("AxoloMonitoring: caller is not an auditor");
        monitoring.validateMeasurement(mId);
    }

    function test_monitoring_caretakerCannotValidate() public {
        (uint256 tankId,) = _setupTankAndAxolotl();
        vm.prank(caretaker);
        uint256 mId = monitoring.recordMeasurement(_params(tankId));

        vm.prank(caretaker);
        vm.expectRevert("AxoloMonitoring: caller is not an auditor");
        monitoring.validateMeasurement(mId);
    }

    function test_monitoring_auditorCannotValidateOwnRecord() public {
        // Grant caretaker role also to auditor account
        vm.startPrank(admin);
        access.grantRole(access.CARETAKER_ROLE(), auditor);
        vm.stopPrank();

        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.startPrank(auditor);
        uint256 mId = monitoring.recordMeasurement(_params(tankId));

        vm.expectRevert("AxoloMonitoring: auditor cannot validate own record");
        monitoring.validateMeasurement(mId);
        vm.stopPrank();
    }

    function test_monitoring_cannotValidateNonExistentMeasurement() public {
        vm.prank(auditor);
        vm.expectRevert("AxoloMonitoring: measurement does not exist");
        monitoring.validateMeasurement(99);
    }

    function test_monitoring_cannotValidateAlreadyValidated() public {
        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.prank(caretaker);
        uint256 mId = monitoring.recordMeasurement(_params(tankId));

        vm.startPrank(auditor);
        monitoring.validateMeasurement(mId);
        vm.expectRevert("AxoloMonitoring: not pending");
        monitoring.validateMeasurement(mId);
        vm.stopPrank();
    }

    function test_monitoring_lastValidatedIdAdvancesMonotonically() public {
        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.startPrank(caretaker);
        uint256 m1 = monitoring.recordMeasurement(_params(tankId));
        uint256 m2 = monitoring.recordMeasurement(_params(tankId));
        vm.stopPrank();

        // Validate in reverse order — lastValidatedId should end up at m2
        vm.startPrank(auditor);
        monitoring.validateMeasurement(m2);
        monitoring.validateMeasurement(m1);
        vm.stopPrank();

        AxoloMonitoring.TankStatus memory ts = monitoring.getTankStatus(tankId);
        assertEq(ts.lastValidatedId, m2); // m2 > m1, pointer must not go backwards
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 6 — AxoloMonitoring: contestation
    // ═══════════════════════════════════════════════════════════════════════

    function test_monitoring_contestMeasurement() public {
        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.prank(caretaker);
        uint256 mId = monitoring.recordMeasurement(_params(tankId));

        vm.prank(auditor);
        monitoring.contestMeasurement(mId, "pH value out of expected range");

        AxoloMonitoring.Measurement memory m = monitoring.getMeasurement(mId);
        assertEq(uint8(m.status), uint8(AxoloMonitoring.MeasurementStatus.Contested));
        assertEq(m.contestReason, "pH value out of expected range");
        assertEq(m.validator, auditor);
    }

    function test_monitoring_contestWithEmptyReasonReverts() public {
        (uint256 tankId,) = _setupTankAndAxolotl();
        vm.prank(caretaker);
        uint256 mId = monitoring.recordMeasurement(_params(tankId));

        vm.prank(auditor);
        vm.expectRevert("AxoloMonitoring: reason cannot be empty");
        monitoring.contestMeasurement(mId, "");
    }

    function test_monitoring_cannotContestAlreadyContested() public {
        (uint256 tankId,) = _setupTankAndAxolotl();
        vm.prank(caretaker);
        uint256 mId = monitoring.recordMeasurement(_params(tankId));

        vm.startPrank(auditor);
        monitoring.contestMeasurement(mId, "First reason");
        vm.expectRevert("AxoloMonitoring: not pending");
        monitoring.contestMeasurement(mId, "Second reason");
        vm.stopPrank();
    }

    function test_monitoring_cannotContestValidated() public {
        (uint256 tankId,) = _setupTankAndAxolotl();
        vm.prank(caretaker);
        uint256 mId = monitoring.recordMeasurement(_params(tankId));

        vm.startPrank(auditor);
        monitoring.validateMeasurement(mId);
        vm.expectRevert("AxoloMonitoring: not pending");
        monitoring.contestMeasurement(mId, "Too late");
        vm.stopPrank();
    }

    function test_monitoring_contestDoesNotUpdateLastValidatedId() public {
        (uint256 tankId,) = _setupTankAndAxolotl();
        vm.prank(caretaker);
        uint256 mId = monitoring.recordMeasurement(_params(tankId));

        vm.prank(auditor);
        monitoring.contestMeasurement(mId, "Bad data");

        // lastValidatedId must remain 0 — contested measurements don't count
        AxoloMonitoring.TankStatus memory ts = monitoring.getTankStatus(tankId);
        assertEq(ts.lastValidatedId, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SECTION 7 — AxoloMonitoring: read helpers
    // ═══════════════════════════════════════════════════════════════════════

    function test_monitoring_getLastValidatedMeasurement() public {
        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.startPrank(caretaker);
        monitoring.recordMeasurement(_params(tankId));
        uint256 m2 = monitoring.recordMeasurement(_params(tankId));
        vm.stopPrank();

        vm.prank(auditor);
        monitoring.validateMeasurement(m2);

        AxoloMonitoring.Measurement memory last =
            monitoring.getLastValidatedMeasurement(tankId);
        assertEq(last.id, m2);
    }

    function test_monitoring_getLastValidatedRevertsIfNone() public {
        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.expectRevert("AxoloMonitoring: no validated measurement for this tank");
        monitoring.getLastValidatedMeasurement(tankId);
    }

    function test_monitoring_measurementCount() public {
        (uint256 tankId,) = _setupTankAndAxolotl();

        vm.startPrank(caretaker);
        monitoring.recordMeasurement(_params(tankId));
        monitoring.recordMeasurement(_params(tankId));
        monitoring.recordMeasurement(_params(tankId));
        vm.stopPrank();

        assertEq(monitoring.measurementCount(), 3);
    }
}
