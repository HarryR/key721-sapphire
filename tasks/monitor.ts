import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { NFT_P256k1 } from "../typechain-types/contracts/NFT_P256k1";
import { Db, DbProp, DbKey721 } from "./database";
import { SupportedCurves } from "./pubkeys";

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

async function* sync_transfers(sync_status:{height:number,prop:DbProp}, c:NFT_P256k1)
{
    let blockno_min = sync_status.height;
    const f = c.filters.Transfer(null, null, null);
    let i = 0;

    while( true )
    {
        const blockno_cur = await c.provider.getBlockNumber();
        let blockno_max = Math.min(blockno_cur, blockno_min + 99);
        if( blockno_min >= blockno_cur ) {
            break;
        }

        let res = await c.queryFilter(f, blockno_min, blockno_max);
        for( const x of res )
        {
            const is_mint = x.args?.from == ZERO_ADDRESS;
            const is_burn = x.args?.to == ZERO_ADDRESS;
            const token_id_hex = x.args?.tokenId.toHexString();

            yield {
                is_mint: is_mint,
                is_burn: is_burn,
                blockNumber: x.blockNumber,
                transactionHash: x.transactionHash,
                key72_id: token_id_hex,
                to: x.args?.to
            }
        }

        blockno_min = blockno_max + 1;
        i += 1;
        if( i % 100 ) {
            sync_status.height = blockno_min;
            sync_status.prop.set(blockno_min.toString());
        }
    }

    sync_status.height = blockno_min;
    sync_status.prop.set(blockno_min.toString());
}

async function get_sync_blockheight(db:Db, deployed_height:string)
{
    let blockno_min = Number.parseInt(deployed_height);
    if( Number.isNaN(blockno_min) ) {
        throw Error(`Error: invalid deployed block height ${deployed_height}`);
    }

    const blockno_prop = db.prop('sync_block');

    if( ! blockno_prop.exists() ) {
        await blockno_prop.set(blockno_min.toString());
    }
    else {
        const x = await blockno_prop.value();
        if( x ) {
            blockno_min = Number.parseInt(x);
            if( Number.isNaN(blockno_min) ) {
                throw Error(`Error: invalid sync block height ${blockno_min}`);
            }
        }
    }

    return {height: blockno_min, prop: blockno_prop};
}

task('key721-monitor')
    .addParam("chain", 'Name of chain')
    .addParam("contract", 'Contract address 0x...')
    .addParam("deployedHeight", 'Contract was deployed at this block number')
    .addParam("dbfile", 'Sqlite database file path')
    .addParam('alg', 'Key pair algorithm or curve')
    .addFlag('stats', 'Display status information')
    .setDescription('Run monitor for NFT (Key721) contract')
    .setAction(monitor_main);
interface MonitorMainArgs {
    alg: SupportedCurves;
    chain: string;
    stats: boolean;
    contract: string;
    deployedHeight: string;
    dbfile: string;
}

async function monitor_main(args:MonitorMainArgs, hre:HardhatRuntimeEnvironment)
{
    const db = await Db.open(args.dbfile);

    if( args.alg != 'secp256k1' && args.alg != 'ed25519' && args.alg != 'bn254' ) {
        console.error(`Error: unknown alg / curve: ${args.alg}`);
        return 1;
    }

    const NFT_P256k1_factory = await hre.ethers.getContractFactory("NFT_P256k1");
    const contract = NFT_P256k1_factory.attach(args.contract);

    let sync_status = await get_sync_blockheight(db, args.deployedHeight);
    const sync_start = sync_status.height;

    let stats = {mints: 0, burns: 0, txfer: 0};
    if( args.stats ) {        
        console.log(`  start: ${sync_status.height}`);
    }

    for await (const x of sync_transfers(sync_status, contract))
    {
        if( x.is_mint )
        {
            if( false === (await db.key721.exists(x.key72_id)) )
            {
                const token = await db.key721.create(new DbKey721(
                    args.chain,
                    contract.address,
                    x.key72_id,
                    args.alg,
                    x.blockNumber,
                    x.transactionHash,
                    x.to,
                    x.blockNumber,
                    0));

                if( args.stats ) {
                    stats.mints += 1;
                    console.log(`... mint ${token.key721_id} by ${token.owner}`);
                }
            }
        }
        else if ( x.is_burn )
        {
            await db.key721.delete(x.key72_id);
            await db.balance.delete_all(x.key72_id);
            await db.keychecks.delete(x.key72_id);

            if( args.stats ) {
                stats.burns += 1;
                console.log(`... burn ${x.key72_id}`);
            }
        }
        else {
            await db.key721.update_owner(x.key72_id, x.to, x.blockNumber);

            if( args.stats ) {
                stats.txfer += 1;
                console.log(`... txfer ${x.key72_id} to ${x.to}`);
            }
        }
    }

    if( args.stats )
    {
        const blocks_processed = sync_status.height - sync_start;

        console.log(` finish: ${sync_status.height}`);
        console.log(` blocks: ${blocks_processed}`);
        console.log(`  mints: ${stats.mints}`);
        console.log(` txfers: ${stats.txfer}`);
        console.log(`  burns: ${stats.burns}`);
    }

    return 0;
}
