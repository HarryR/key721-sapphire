import readline from "readline";
import fs from "fs";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SupportedCurves } from "./pubkeys";
import { NFT_BN254__factory, NFT_ED25519__factory, NFT_P256k1__factory, NFT_X25519__factory } from "../typechain-types";

// Urgh... any easier way to do this? I thought union types would simplify things
export async function key721_factory(alg:'bn254', hre:HardhatRuntimeEnvironment) : Promise<NFT_BN254__factory>;
export async function key721_factory(alg:'ed25519', hre:HardhatRuntimeEnvironment) : Promise<NFT_ED25519__factory>;
export async function key721_factory(alg:'x25519', hre:HardhatRuntimeEnvironment) : Promise<NFT_X25519__factory>;
export async function key721_factory(alg:'secp256k1', hre:HardhatRuntimeEnvironment) : Promise<NFT_P256k1__factory>;
export async function key721_factory(alg:SupportedCurves, hre:HardhatRuntimeEnvironment) : Promise<NFT_BN254__factory | NFT_ED25519__factory | NFT_P256k1__factory>;

export async function key721_factory(alg:SupportedCurves, hre:HardhatRuntimeEnvironment)
{
  switch(alg) {
    case "bn254": return await hre.ethers.getContractFactory('NFT_BN254');
    case "ed25519": return await hre.ethers.getContractFactory('NFT_ED25519');
    case "x25519": return await hre.ethers.getContractFactory('NFT_X25519');
    case "secp256k1": return await hre.ethers.getContractFactory('NFT_P256k1');
  }
}

try {
  // Task defined this way so pubkeys can be imported outside of hardhat environment
  const { task } = require("hardhat/config");
  task('key721-deploy')
      .addFlag('yes', 'Assume y to questions')
      .addFlag('debug', 'Show debug info')
      .addPositionalParam('alg', 'Algorithm or curve')
      .setDescription('Deploy a variant of the Key721 contract')
      .setAction(main)
      ;
} catch(e) {}

function askQuestion(query:string) : Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

interface DeployMainArgs {
  yes: boolean;
  debug: boolean;
  alg: SupportedCurves;
}

async function main(args:DeployMainArgs, hre:HardhatRuntimeEnvironment)
{
  const ethers = hre.ethers;

  const contract = await key721_factory(args.alg, hre);

  const chain_id = await contract.signer.getChainId();

  if( args.debug ) {
    console.log();  
    console.log(`    Chain ID: ${chain_id} (0x${chain_id.toString(16)})`);
    console.log('  RPC Server: ' + ethers.provider.connection.url);
    console.log('     Account: ' + await contract.signer.getAddress());
    console.log('     Balance: ' + ethers.utils.formatEther(await contract.signer.getBalance()));
  }

  const deploy_tx = contract.getDeployTransaction();
  const deploy_gas = await contract.signer.estimateGas(deploy_tx);
  const fee_data = await contract.signer.getFeeData();

  if( args.debug )
  {
    console.log('  Deploy Gas: ' + deploy_gas);
    if( fee_data.gasPrice ) {
      console.log('   Gas Price: ' + ethers.utils.formatUnits(fee_data.gasPrice, 'gwei') + ' gwei');
      console.log(' Deploy Cost: ' + ethers.utils.formatEther(fee_data.gasPrice.mul(deploy_gas)) + ' (estimate)');
    }
  
    if( ! args.yes ) {
      const response = await askQuestion("\nDeploy? [y/n] ");
      if( response.toLowerCase() != "y" && response.toLowerCase() != "yes" ) {
        return 2;
      }
    }

    console.log("\nDeploying...\n");
  }

  const onchain = await contract.deploy();
  if( args.debug ) console.log('      TX: ' + onchain.deployTransaction.hash);
  fs.writeFileSync(`./cache/${args.alg}.tx`, onchain.deployTransaction.hash);

  const receipt = await onchain.deployed();

  const blockHash = onchain.deployTransaction.blockHash;
  if( blockHash ) {
    if( args.debug ) console.log('   Block: ' + blockHash);
    fs.writeFileSync(`./cache/${args.alg}.block`, blockHash);
  }

  const blockHeight = onchain.deployTransaction.blockNumber;
  if( blockHeight ) {
    if( args.debug ) console.log('  Height: ' + onchain.deployTransaction.blockNumber);
    fs.writeFileSync(`./cache/${args.alg}.height`, blockHeight.toString());
  }

  if( args.debug ) console.log(' Address: ' + receipt.address);
  fs.writeFileSync(`./cache/${args.alg}.address`, receipt.address);

  if( args.debug ) {
    console.log();
  }
  else {
    console.log(receipt.address);
  }
  return 0;
}
