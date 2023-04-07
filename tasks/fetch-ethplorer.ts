import { task, types } from "hardhat/config";
import { Db, DbToken } from "./database";
import fetch from 'node-fetch';
import { key721_id_to_p256k1_points, p256k1_point_to_eth_address } from "./pubkeys";

task('key721-fetch-ethplorer')
    .addFlag('debug', 'Display debugging information')
    .addOptionalParam('recheckHours', 'Recheck token balances every N hours', 168, types.int)
    .addOptionalParam('apikey', 'Ethplorer.io API key', 'freekey')
    .addPositionalParam('dbfile', 'Sqlite database file path')
    .addPositionalParam('chain', 'Name of the chain', 'eth')
    .setDescription('Use ethplorer.io API to retrieve token balances')
    .setAction(main);

type ChainName = 'eth' | 'kovan';

interface MainArgs {
    debug: boolean;
    recheckHours: number;
    dbfile: string;
    chain: ChainName;
    apikey: string;
}

function delay(time_milliseconds:number) {
    return new Promise(resolve => setTimeout(resolve, time_milliseconds));
}

interface EthplorerAddressInfo {
    address:string;
    ETH: {                  // ETH specific information,
        price:{
            rate:number;
            ts:number;
        };
        balance:number;     // ETH balance (integer, may be slightly inaccurate on huge numbers),
        rawBalance:string;  // balance in wei, as a string,
    },
    tokens: {               // exists if the specified address has any token balances
        tokenInfo:{         // token data (same format as token info),
            address:string;
            name:string;
            symbol:string;
            decimals:number;
            description:string|undefined;
            website:string|undefined;
        };   
        balance:number;     // token balance (integer, may be slightly inaccurate on huge numbers),
        rawBalance:string;  // exact token balance, as a string,
    }[];
    countTxs: number;       // total number of incoming and outgoing transactions (including contract creation)
}

// See: https://github.com/EverexIO/Ethplorer/wiki/Ethplorer-API
// Example: const resp = await fetch_address('0x58b704065b7aff3ed351052f8560019e05925023');
// Consider using bulk API: https://docs.ethplorer.io/monitor?from=apiDocs
async function fetch_address(chain:ChainName, address:string, apikey:string='freekey')
{
    const baseurl = chain == 'kovan' ? 'https://kovan-api.ethplorer.io' : 'https://api.ethplorer.io';
    const url = `${baseurl}/getAddressInfo/${address}?apiKey=${apikey}`

    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json'
        }
    });

    if( false == resp.ok ) {
        throw new Error(`Error: status ${resp.status} fetch ${url}`);
    }

    return (await resp.json()) as EthplorerAddressInfo;
}

async function main(args: MainArgs)
{
    const db = await Db.open(args.dbfile);

    let native_token : DbToken;

    if( args.chain == 'eth' ) {
        native_token = await db.token.sync({
            chain: args.chain,
            contract: null,
            name: "Ethereum",
            decimals: 18,
            symbol: "ETH",
            description: "Ethereum native gas unit",
            website: "https://ethereum.org/"
        });
    }
    else if( args.chain == "kovan" ) {
        native_token = await db.token.sync({
            chain: args.chain,
            contract: null,
            name: "Kovan",
            decimals: 18,
            symbol: "KOVAN",
            description: "Kovan native gas unit",
            website: "https://kovan-testnet.github.io/website/"
        });
    }
    else {
        console.log(`Error: unknown chain ${args.chain}`);
        return 1;
    }

    const api_name = 'ethplorer';

    const height = await db.fetchers.sync(api_name, args.chain);

    // TODO: find NFTs which require rechecking

    for( const nft of await db.key721.find_unchecked(api_name, args.chain, height) )
    {
        console.log(`... checking ${nft.key721_id}`);

        await db.balance.delete_all(nft.key721_id, api_name);

        const unchecked_addresses = key721_id_to_p256k1_points(nft.key721_id).map(p256k1_point_to_eth_address);

        unchecked_addresses.push('0x58b704065b7aff3ed351052f8560019e05925023'); // For testing

        for( const eth_addr of unchecked_addresses )
        {
            console.log(`   ... ${eth_addr}`);

            const resp = await fetch_address(args.chain, eth_addr);

            console.log(resp);

            if( resp.ETH.rawBalance != "0" )
            {
                db.balance.create({
                    api: api_name,
                    chain: args.chain,
                    token_contract: null,
                    key721_id: nft.key721_id,
                    stamp: Math.floor(Date.now() / 1000),
                    amount: resp.ETH.rawBalance
                });

                console.log(`      ... ${native_token.symbol} ${resp.ETH.rawBalance}`);
            }

            for( const deposit of resp.tokens )
            {
                const token = await db.token.sync({
                    chain: args.chain,
                    contract: deposit.tokenInfo.address,
                    name: deposit.tokenInfo.name,
                    decimals: deposit.tokenInfo.decimals,
                    symbol: deposit.tokenInfo.symbol,
                    description: deposit.tokenInfo.description || "",
                    website: deposit.tokenInfo.website || ""
                });

                await db.balance.create({
                    api: api_name,
                    chain: args.chain,
                    token_contract: token.contract,
                    key721_id: nft.key721_id,
                    stamp: Math.floor(Date.now() / 1000),
                    amount: deposit.rawBalance
                });

                console.log(`      ... ${token.contract} ${deposit.rawBalance}`);
            }
        }

        // Schedule a re-check in the future
        const now = Math.floor(Date.now() / 1000);
        const recheck_seconds = args.recheckHours * 60 * 60;
        db.keychecks.sync(api_name, nft.key721_id, now + recheck_seconds, now);
    }

    return 0;
}