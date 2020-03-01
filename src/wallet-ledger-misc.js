const indy = require("indy-sdk");
const util = require("./util");
const COLOR = require("./colors");
const fetch = require("node-fetch");
const { URLSearchParams } = require("url");

const log = console.log;

const ISSUER_COLOR = COLOR.CYAN;
const PROVER_COLOR = COLOR.MAGENTA;
const VERIFIER_COLOR = COLOR.YELLOW;

const ISSUER_ADDRESS = "http://localhost:3000/issuer";
const PROVER_ADDRESS = "http://localhost:3001/prover";
const VERIFIER_ADDRESS = "http://localhost:3002/verifier";

// Logging Functions

function logIssuer(s) {
  log(ISSUER_COLOR + s + COLOR.NONE);
}
function logProver(s) {
  log("\t" + PROVER_COLOR + s + COLOR.NONE);
}
function logVerifier(s) {
  log("\t\t" + VERIFIER_COLOR + s + COLOR.NONE);
}
function logOK(s) {
  log(COLOR.GREEN + s + COLOR.NONE);
}
function logKO(s) {
  log(COLOR.RED + s + COLOR.NONE);
}

// Communication Functions
async function sendToProver(type, message) {
  console.log(PROVER_ADDRESS);
  console.log(type);
  console.log(message);
  try {
    const params = new URLSearchParams();
    params.append("type", type);
    params.append("message", message);
    await fetch(PROVER_ADDRESS, {
      method: "post",
      body: params
    })
      .then(res => res.json())
      .then(json => console.log(json));
  } catch (error) {
    console.log(error);
  }
}

async function sendToVerfier(type, message) {}

async function sendToIssuer(type, message) {}

// Wallet Functions

async function createAndOpenWallet(actor) {
  const walletConfig = { id: actor + ".wallet" };
  const walletCredentials = { key: actor + ".wallet_key" };
  await indy.createWallet(walletConfig, walletCredentials);
  return await indy.openWallet(walletConfig, walletCredentials);
}

async function closeAndDeleteWallet(wallet, actor) {
  await indy.closeWallet(wallet);
  const walletConfig = { id: actor + ".wallet" };
  const walletCredentials = { key: actor + ".wallet_key" };
  await indy.deleteWallet(walletConfig, walletCredentials);
}

// Pool Handler Functions

async function createAndOpenPoolHandle(actor) {
  const poolName = actor + "-pool-sandbox";
  const poolGenesisTxnPath = await util.getPoolGenesisTxnPath(poolName);
  const poolConfig = { genesis_txn: poolGenesisTxnPath };
  await indy.createPoolLedgerConfig(poolName, poolConfig).catch(e => {
    console.log("ERROR : ", e);
    process.exit();
  });
  return await indy.openPoolLedger(poolName, poolConfig);
}

async function closeAndDeletePoolHandle(poolHandle, actor) {
  await indy.closePoolLedger(poolHandle);
  const poolName = actor + "-pool-sandbox";
  await indy.deletePoolLedgerConfig(poolName);
}

// DID Functions

async function createAndStoreMyDid(wallet, seed) {
  const [did] = await indy.createAndStoreMyDid(wallet, { seed: seed });
  return did;
}

// Ledger Functions

function checkResponse(response) {
  if (!response) {
    throw new Error(
      "ERROR in 'ensurePreviousRequestApplied' : response is undefined !"
    );
  }
  if (response.op === "REJECT") {
    throw new Error(
      "ERROR in 'ensurePreviousRequestApplied' : response.op is " +
        response.op +
        " and must be REPLY. Reason : " +
        response.reason
    );
  }
  if (response.op !== "REPLY") {
    throw new Error(
      "ERROR in 'ensurePreviousRequestApplied' : response.op is " +
        response.op +
        " and must be REPLY"
    );
  }
  if (!response.result) {
    throw new Error(
      "ERROR in 'ensurePreviousRequestApplied' : response.result is undefined ! response=" +
        JSON.stringify(response)
    );
  }
}

async function ensureSubmitRequest(poolHandle, request) {
  const response = await indy.submitRequest(poolHandle, request);
  checkResponse(response);
  return response;
}

async function ensureSignAndSubmitRequest(poolHandle, wallet, did, request) {
  const response = await indy.signAndSubmitRequest(
    poolHandle,
    wallet,
    did,
    request
  );
  checkResponse(response);
  return response;
}

async function postSchemaToLedger(poolHandle, wallet, did, schema) {
  const schemaRequest = await indy.buildSchemaRequest(did, schema);
  try {
    await ensureSignAndSubmitRequest(poolHandle, wallet, did, schemaRequest);
  } catch (e) {
    // Accept if schema already exists
    if (e.message.indexOf("can have one and only one SCHEMA with name")) {
      return;
    }
    throw e;
  }
}

async function getSchemaFromLedger(poolHandle, did, schemaId) {
  const getSchemaRequest = await indy.buildGetSchemaRequest(did, schemaId);
  const getSchemaResponse = await ensureSubmitRequest(
    poolHandle,
    getSchemaRequest
  );
  const [, schema] = await indy.parseGetSchemaResponse(getSchemaResponse);
  return schema;
}

async function getCredDefFromLedger(poolHandle, did, credDefId) {
  const getCredDefRequest = await indy.buildGetCredDefRequest(did, credDefId);
  const getCredDefResponse = await ensureSubmitRequest(
    poolHandle,
    getCredDefRequest
  );
  const [, credDef] = await indy.parseGetCredDefResponse(getCredDefResponse);
  return credDef;
}

async function postCredDefToLedger(poolHandle, wallet, did, credDef) {
  const credDefRequest = await indy.buildCredDefRequest(did, credDef);
  await ensureSignAndSubmitRequest(poolHandle, wallet, did, credDefRequest);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  log,
  logIssuer,
  logProver,
  logVerifier,
  logOK,
  logKO,
  createAndOpenWallet,
  closeAndDeleteWallet,
  createAndOpenPoolHandle,
  closeAndDeletePoolHandle,
  createAndStoreMyDid,
  checkResponse,
  ensureSubmitRequest,
  ensureSignAndSubmitRequest,
  postSchemaToLedger,
  getSchemaFromLedger,
  getCredDefFromLedger,
  postCredDefToLedger,
  sendToProver,
  sendToVerfier,
  sendToIssuer,
  sleep
};
