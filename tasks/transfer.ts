import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task('key721-transfer')
    .addPositionalParam("contract", 'Contract address')
    .addPositionalParam("token", 'Which Token')
    .addPositionalParam("owner", 'Current Owner')
    .addPositionalParam("address", 'Destination Address')
    .addFlag('safe', 'Use safeTransfer')
    .addOptionalParam('data', 'Extra data to be passed')
    .setDescription('Run NFT_p256k1 transfer utility')
    .setAction(main);

interface MainArgs {
    safe: boolean;
    contract: string;
    token: string;
    owner: string;
    address: string;
    data: string | undefined;
}

async function main(args: MainArgs, hre:HardhatRuntimeEnvironment)
{
    const ethers = hre.ethers;
    const NFT_P256k1_factory = await ethers.getContractFactory("NFT_P256k1");
    const contract = NFT_P256k1_factory.attach(args.contract);

    console.log(` contract: ${args.contract}`)
    console.log(`    owner: ${args.owner}`)
    console.log(`       to: ${args.address}`)
    console.log(`    token: ${args.token}`)

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

    const x = await tx.wait();
    console.log(`       tx: ${x.transactionHash}`)
    console.log(`      gas: ${x.gasUsed}`)
}
