import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BigNumber } from "ethers";
import { key721_factory } from "./deploy";
import { SupportedCurves, key721_id_to_addresses } from "./pubkeys";

task('key721-mint')
    .addFlag('debug', 'Show debug info')
    .addParam('alg', 'Curve or algorithm')
    .addPositionalParam("contract", 'Contract address 0x...')
    .addOptionalPositionalParam('to', 'Mint to address 0x...')
    .setDescription('Mint a NFT_p256k1 token')
    .setAction(main);

interface MainArgs {
    alg: SupportedCurves;
    debug: boolean;
    contract: string;
    to: string | null;
}

async function main(args:MainArgs, hre:HardhatRuntimeEnvironment)
{
    const factory = await key721_factory(args.alg, hre);
    const contract = factory.attach(args.contract);

    let tx;
    if( args.to ) {
        tx = await contract["mint(address)"](args.to);
    }
    else {
        tx = await contract["mint()"]();
    }

    let receipt = await tx.wait();

    if( args.debug ) {
        console.error(`       tx: ${tx.hash} (height: ${tx.blockNumber})`);
        console.error(` gas used: ${receipt.gasUsed}`);
    }

    if( receipt.events?.length )
    {
        const owner = receipt.events[0].args?.[1];
        const tokenId : BigNumber = receipt.events[0].args?.[2];

        if( args.debug ) {
            console.error(`  tokenId: ${tokenId.toHexString()}`);
            console.error(`    owner: ${owner}`);

            // Ensure the correct token id can be regurgitated correctly after a full circle parse then serialize
            console.error( await key721_id_to_addresses(args.alg, tokenId) );
        }

        console.log(tokenId.toHexString());

        return 0;
    }

    console.error(receipt);
    throw Error('Error minting!');
}
