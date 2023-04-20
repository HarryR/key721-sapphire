import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SupportedCurves } from "./pubkeys";
import { key721_factory } from "./deploy";

task('key721-transfer')
    .addPositionalParam("contract", 'Contract address')
    .addPositionalParam("token", 'Which Token')
    .addPositionalParam("owner", 'Current Owner')
    .addPositionalParam("address", 'Destination Address')
    .addParam('alg', 'Algorithm or curve')
    .addFlag('safe', 'Use safeTransfer')
    .addFlag('debug', 'Show debugginf info')
    .addOptionalParam('data', 'Extra data to be passed')
    .setDescription('Run NFT_p256k1 transfer utility')
    .setAction(transfer_main);

interface TransferMainArgs {
    alg: SupportedCurves;
    debug: boolean;
    safe: boolean;
    contract: string;
    token: string;
    owner: string;
    address: string;
    data: string | undefined;
}

async function transfer_main(args: TransferMainArgs, hre:HardhatRuntimeEnvironment)
{
    const factory = await key721_factory(args.alg, hre);
    const contract = factory.attach(args.contract);

    if( args.debug ) {
        console.error(` contract: ${args.contract}`)
        console.error(`    owner: ${args.owner}`)
        console.error(`       to: ${args.address}`)
        console.error(`    token: ${args.token}`)
    }
    
    let tx;
    if( args.safe ) {
        if( args.data ) {
            tx = await contract["safeTransferFrom(address,address,uint256,bytes)"](args.owner, args.address, args.token, args.data);
        }
        else {
            tx = await contract["safeTransferFrom(address,address,uint256)"](args.owner, args.address, args.token);
        }
    }
    else {
        if( args.data ) {
            throw Error('Cannot call transferFrom with data parameter');
        }
        tx = await contract.transferFrom(args.owner, args.address, args.token);
    }

    const receipt = await tx.wait();

    if( args.debug ) {
        console.error(`       tx: ${receipt.transactionHash}`)
        console.error(`      gas: ${receipt.gasUsed}`)
    }

    console.log(receipt.transactionHash);
}
