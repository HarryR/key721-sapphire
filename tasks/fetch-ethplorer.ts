import { task, types } from "hardhat/config";
import { Db, DbProp, DbKey721 } from "./database";
import fetch from 'node-fetch';

task('key721-fetch-ethplorer')
    .addFlag('debug', 'Display debugging information')
    .addOptionalParam('recheck', 'Recheck token balances every N hours', 168, types.int)
    .addPositionalParam("dbfile", 'Sqlite database file path')
    .addPositionalParam("apikey", 'Ethplorer.io API key', 'freekey')
    .setDescription('Use ethplorer.io API to retrieve token balances')
    .setAction(main);

interface MainArgs {
    debug: boolean;
    recheck: string;
    dbfile: string;
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
            decimals:number;
        };   
        balance:number;     // token balance (integer, may be slightly inaccurate on huge numbers),
        rawBalance:string;  // exact token balance, as a string,
    }[];
    countTxs: number;       // total number of incoming and outgoing transactions (including contract creation)
}

// See: https://github.com/EverexIO/Ethplorer/wiki/Ethplorer-API
// Example: const resp = await fetch_address('0x58b704065b7aff3ed351052f8560019e05925023');
async function fetch_address(address:string, apikey:string='freekey')
{
    const url = `https://api.ethplorer.io/getAddressInfo/${address}?apiKey=${apikey}`
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
    const resp = await fetch_address('0x58b704065b7aff3ed351052f8560019e05925023');
    console.log(resp);
    for( const x of resp.tokens ) {
        console.log(x);
    }    
    /*
    const db = await Db.open(args.dbfile);
    const ethplorer_height = db.prop('ethplorer_height');
    
    if( false == await ethplorer_height.exists() ) {
        await ethplorer_height.set("0");
    }

    while( true )
    {
        const raw_height = await ethplorer_height.value();
        const height = raw_height ? Number.parseInt(raw_height) : 0;
        for( const t of await db.tokens_since(height) ) {

        }
        delay(1000*60);
    }
    // TODO: fetch newly created tokens since the last time we checked
    */
}