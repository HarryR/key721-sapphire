import { task } from "hardhat/config";
import readline from "readline";
import fs from "fs";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task('key721-deploy')
    .addFlag('yes', 'Assume y to questions')
    .addFlag('debug', 'Show debug info')
    .setDescription('Deploy the NFT_p256k1 contract')
    .setAction(main)
    ;

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

interface MainArgs {
  yes: boolean;
  debug: boolean;
}

async function main(args:MainArgs, hre:HardhatRuntimeEnvironment)
{
  const ethers = hre.ethers;

  const NFT_P256k1 = await ethers.getContractFactory("NFT_P256k1");

  const chain_id = await NFT_P256k1.signer.getChainId();

  if( args.debug ) {
    console.log();  
    console.log(`    Chain ID: ${chain_id} (0x${chain_id.toString(16)})`);
    console.log('  RPC Server: ' + ethers.provider.connection.url);
    console.log('     Account: ' + await NFT_P256k1.signer.getAddress());
    console.log('     Balance: ' + ethers.utils.formatEther(await NFT_P256k1.signer.getBalance()));
  }

  const deploy_tx = NFT_P256k1.getDeployTransaction();
  const deploy_gas = await NFT_P256k1.signer.estimateGas(deploy_tx);
  const fee_data = await NFT_P256k1.signer.getFeeData();

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

  const onchain = await NFT_P256k1.deploy();  
  if( args.debug ) console.log('      TX: ' + onchain.deployTransaction.hash);
  fs.writeFileSync("./cache/deployed.tx", onchain.deployTransaction.hash);

  const receipt = await onchain.deployed();

  const blockHash = onchain.deployTransaction.blockHash;
  if( blockHash ) {
    if( args.debug ) console.log('   Block: ' + blockHash);
    fs.writeFileSync("./cache/deployed.block", blockHash);
  }

  const blockHeight = onchain.deployTransaction.blockNumber;
  if( blockHeight ) {
    if( args.debug ) console.log('  Height: ' + onchain.deployTransaction.blockNumber);
    fs.writeFileSync("./cache/deployed.height", blockHeight.toString());
  }

  if( args.debug ) console.log(' Address: ' + receipt.address);
  fs.writeFileSync("./cache/deployed.address", receipt.address);

  if( args.debug ) {
    console.log();
  }
  else {
    console.log(receipt.address);
  }
  return 0;
}
