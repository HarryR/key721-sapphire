import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BigNumber } from "ethers";

task('key721-mint')
    .addFlag('debug', 'Show debug info')
    .addPositionalParam("contract", 'Contract address 0x...')
    .addOptionalPositionalParam('to', 'Mint to address 0x...')
    .setDescription('Mint a NFT_p256k1 token')
    .setAction(main);

interface MainArgs {
    debug: boolean;
    contract: string;
    to: string | null;
}

async function main(args: MainArgs, hre:HardhatRuntimeEnvironment)
{
    const ethers = hre.ethers;
    const NFT_P256k1_factory = await ethers.getContractFactory("NFT_P256k1");
    const contract = NFT_P256k1_factory.attach(args.contract);

    let tx;
    if( args.to ) {
        tx = await contract["mint(address)"](args.to);
    } else {
        tx = await contract["mint()"]();
    }
    
    let receipt = await tx.wait();

    if( args.debug ) {
        console.log(`       tx: ${tx.hash} (height: ${tx.blockNumber})`);
        console.log(` gas used: ${receipt.gasUsed}`);
        console.log(receipt);
    }    

    if( receipt.events )
    {
        const owner = receipt.events[0].args?.[1];
        const tokenId : BigNumber = receipt.events[0].args?.[2];

        if( args.debug ) {
            console.log(`  tokenId: ${tokenId.toHexString()}`);
            console.log(`    owner: ${owner}`);
        }
        else {
            console.log(tokenId.toHexString());
        }
    } else {
        console.error(receipt);
    }
}
