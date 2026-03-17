// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  AxoloDAO — Backend Relayer (Gas Sponsor)                                ║
// ║  Servidor HTTP local que executa transações gasless em nome dos usuários  ║
// ║  usando ERC2771Context + RELAYER_WALLET como trustedForwarder.            ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const ethers  = require('ethers');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Provider & Wallet ──────────────────────────────────────────────────────

const provider      = new ethers.JsonRpcProvider(process.env.RPC_URL);
const relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);

// ─── Contract Addresses ─────────────────────────────────────────────────────

const CONTRACTS = {
  access:     process.env.ACCESS_CONTRACT,
  registry:   process.env.REGISTRY_CONTRACT,
  monitoring: process.env.MONITORING_CONTRACT,
};

// ─── Minimal ABIs (only what the backend needs) ─────────────────────────────

const ABI_ACCESS = [
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function CARETAKER_ROLE() view returns (bytes32)',
  'function AUDITOR_ROLE() view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
];

const accessContract = new ethers.Contract(CONTRACTS.access, ABI_ACCESS, provider);

// ─── Role mapping: which role is required for each contract ─────────────────

// The backend determines the required role by matching the function selector
// in the calldata against known function signatures.

const SELECTORS = {
  // AxoloRegistry functions → CARETAKER_ROLE
  registerTank:       ethers.id('registerTank(string,string)').slice(0, 10),
  registerAxolotl:    ethers.id('registerAxolotl(string,string,uint256,uint256,string,bytes32)').slice(0, 10),
  updateTank:         ethers.id('updateTank(uint256,string,string)').slice(0, 10),
  updateAxolotl:      ethers.id('updateAxolotl(uint256,string,string,bytes32)').slice(0, 10),
  deactivateTank:     ethers.id('deactivateTank(uint256)').slice(0, 10),
  deactivateAxolotl:  ethers.id('deactivateAxolotl(uint256)').slice(0, 10),
  transferAxolotl:    ethers.id('transferAxolotl(uint256,uint256)').slice(0, 10),

  // AxoloMonitoring functions
  recordMeasurement:  ethers.id('recordMeasurement((uint256,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16))').slice(0, 10),
  validateMeasurement:ethers.id('validateMeasurement(uint256)').slice(0, 10),
  contestMeasurement: ethers.id('contestMeasurement(uint256,string)').slice(0, 10),

  // AxoloAccess
  registrarAcesso:    ethers.id('registrarAcesso(string,bytes32)').slice(0, 10),
};

// Map function selector → required role name
const SELECTOR_TO_ROLE = {};
// Caretaker functions
['registerTank','registerAxolotl','updateTank','updateAxolotl',
 'deactivateTank','deactivateAxolotl','transferAxolotl',
 'recordMeasurement'].forEach(fn => {
  SELECTOR_TO_ROLE[SELECTORS[fn]] = 'CARETAKER_ROLE';
});
// Auditor functions
['validateMeasurement','contestMeasurement'].forEach(fn => {
  SELECTOR_TO_ROLE[SELECTORS[fn]] = 'AUDITOR_ROLE';
});
// registrarAcesso has no role prerequisite (self-registration via ENS)
SELECTOR_TO_ROLE[SELECTORS.registrarAcesso] = null;


// ─── Helper: get required role for a calldata ───────────────────────────────

async function getRequiredRole(data) {
  const selector = data.slice(0, 10);
  const roleName = SELECTOR_TO_ROLE[selector];

  if (roleName === undefined) {
    return { error: `Unknown function selector: ${selector}` };
  }
  if (roleName === null) {
    return { role: null }; // No role required (e.g., registrarAcesso)
  }

  const roleHash = roleName === 'CARETAKER_ROLE'
    ? await accessContract.CARETAKER_ROLE()
    : await accessContract.AUDITOR_ROLE();

  return { role: roleHash, roleName };
}


// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /health ────────────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
  try {
    const balance = await provider.getBalance(relayerWallet.address);
    const network = await provider.getNetwork();
    res.json({
      status:  'ok',
      relayer: relayerWallet.address,
      balance: ethers.formatEther(balance) + ' ETH',
      network: network.name,
      chainId: Number(network.chainId),
      contracts: CONTRACTS,
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});


// ─── POST /relay ────────────────────────────────────────────────────────────

app.post('/relay', async (req, res) => {
  const { target, data, user, signature } = req.body;

  // 1. Validate body
  if (!target || !data || !user || !signature) {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: 'Missing required fields: target, data, user, signature',
    });
  }

  try {
    // 2. Verify signature
    //    The frontend signs the raw calldata bytes with personal_sign.
    //    We recover the signer and verify it matches the declared user.
    const messageHash = ethers.hashMessage(ethers.getBytes(data));
    const recoveredAddr = ethers.recoverAddress(messageHash, signature);

    if (recoveredAddr.toLowerCase() !== user.toLowerCase()) {
      console.log(`[AUTH] Signature mismatch: recovered=${recoveredAddr}, declared=${user}`);
      return res.status(401).json({
        error: 'INVALID_SIGNATURE',
        message: `Signature does not match user address. Recovered: ${recoveredAddr}`,
      });
    }
    console.log(`[AUTH] Signature verified for ${user}`);

    // 3. Verify role on-chain
    const { role, roleName, error } = await getRequiredRole(data);
    if (error) {
      return res.status(400).json({ error: 'UNKNOWN_FUNCTION', message: error });
    }

    if (role !== null) {
      const hasRole = await accessContract.hasRole(role, user);
      if (!hasRole) {
        console.log(`[AUTH] User ${user} lacks ${roleName}`);
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: `User ${user} does not have ${roleName}`,
        });
      }
      console.log(`[AUTH] User ${user} has ${roleName}`);
    } else {
      console.log(`[AUTH] No role required for this function`);
    }

    // 4. Build ERC2771 calldata: original data + user address (20 bytes)
    //    This is the standard ERC2771 pattern:
    //    The trusted forwarder appends the original sender's address
    //    to the calldata. The contract reads it via _msgSender().
    const erc2771Data = ethers.concat([
      data,
      ethers.zeroPadValue(user, 20),
    ]);

    // 5. Send transaction
    console.log(`[TX] Sending to ${target} for user ${user}...`);
    const tx = await relayerWallet.sendTransaction({
      to:   target,
      data: erc2771Data,
    });

    console.log(`[TX] Hash: ${tx.hash} — waiting for confirmation...`);
    const receipt = await tx.wait();
    console.log(`[TX] Confirmed in block ${receipt.blockNumber}`);

    // 6. Return result
    return res.json({
      txHash:      receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed:     receipt.gasUsed.toString(),
      from:        relayerWallet.address,
      onBehalfOf:  user,
    });

  } catch (e) {
    console.error('[ERROR]', e.message);

    // Try to extract revert reason from on-chain error
    let message = e.message;
    if (e.reason) message = e.reason;
    if (e.data) {
      try {
        const iface = new ethers.Interface(['error Error(string)']);
        const decoded = iface.parseError(e.data);
        if (decoded) message = decoded.args[0];
      } catch {}
    }

    return res.status(500).json({
      error:   'TX_FAILED',
      message: message,
    });
  }
});


// ─── GET /roles/:addr ───────────────────────────────────────────────────────

app.get('/roles/:addr', async (req, res) => {
  try {
    const addr = req.params.addr;
    const [caretakerRole, auditorRole, adminRole] = await Promise.all([
      accessContract.CARETAKER_ROLE(),
      accessContract.AUDITOR_ROLE(),
      accessContract.DEFAULT_ADMIN_ROLE(),
    ]);
    const [isCaretaker, isAuditor, isAdmin] = await Promise.all([
      accessContract.hasRole(caretakerRole, addr),
      accessContract.hasRole(auditorRole, addr),
      accessContract.hasRole(adminRole, addr),
    ]);
    res.json({
      address:   addr,
      caretaker: isCaretaker,
      auditor:   isAuditor,
      admin:     isAdmin,
    });
  } catch (e) {
    res.status(500).json({ error: 'QUERY_FAILED', message: e.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║       AxoloDAO — Backend Relayer v1.0             ║');
  console.log('║       BioMuseo Xolotcalli · Sepolia               ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Relayer:  ${relayerWallet.address}`);
  console.log(`  RPC:      ${process.env.RPC_URL?.slice(0, 40)}...`);
  console.log(`  Port:     ${PORT}`);
  console.log('');
  console.log('  Contracts:');
  console.log(`    Access:     ${CONTRACTS.access}`);
  console.log(`    Registry:   ${CONTRACTS.registry}`);
  console.log(`    Monitoring: ${CONTRACTS.monitoring}`);
  console.log('');
  console.log('  Routes:');
  console.log('    GET  /health       → status + saldo da wallet');
  console.log('    POST /relay        → executa transação gasless');
  console.log('    GET  /roles/:addr  → consulta roles de um endereço');
  console.log('');
  console.log('  Ready.');
  console.log('');
});
