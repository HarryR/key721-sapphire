import { task, types } from "hardhat/config";
import { Db, DbBalance, DbToken } from "./database";
import fetch from 'node-fetch';
import { key721_id_to_p256k1_points, p256k1_point_to_eth_address } from "./pubkeys";
import { BigNumber } from "ethers";

// Reference:
// - https://docs.blockscout.com/for-users/api/rpc-endpoints

interface BlockscoutAPI {
    api_url: string;
    native_decimals: number;
    native_symbol: string;
    name: string;
    description: string;
    website: string;
}

// Known blockscout compatible APIs for some chains, just specify the --chain
const BLOCKSCOUT_FOR_CHAIN:Record<string,BlockscoutAPI> = {
    eth: {
        api_url: 'https://blockscout.com/eth/mainnet/api',
        native_decimals: 18,
        native_symbol: 'ETH',
        name: 'Ethereum',
        description: 'Ethereum native gas unit',
        website: 'https://ethereum.org/'
    },
    xdai: {
        api_url: 'https://blockscout.com/xdai/mainnet/api',
        native_decimals: 18,
        native_symbol: 'xDAI',
        name: 'Gnosis Chain',
        description: 'Gnosis Chain is one of the first Ethereum sidechains and has stayed true to its values.',
        website: 'https://www.gnosis.io/'
    },
    goerli: {
        api_url: 'https://eth-goerli.blockscout.com/api',
        native_decimals: 18,
        native_symbol: 'ETH',
        name: 'Goerli',
        description: 'A cross-client proof-of-authority testing network for Ethereum.',
        website: 'https://goerli.net/'
    },
    emerald: {
        api_url: 'https://explorer.emerald.oasis.dev/api',
        native_decimals: 18,
        native_symbol: 'ROSE',
        name: 'Oasis Emerald',
        description: 'Emerald offers full EVM compatibility, scalability, low gas fees and cross-chain interoperability.',
        website: 'https://oasisprotocol.org/technology#emerald'
    }
};

// ------------------------------------------------------------------

function delay(time_milliseconds:number) {
    return new Promise(resolve => setTimeout(resolve, time_milliseconds));
}

async function jsonrpc_get(url:string, params:URLSearchParams|null=null)
{
    if( params ) {
        url += '?' + params.toString();
    }

    const resp = await fetch(url, {
        method: 'GET',
        headers: {Accept: 'application/json'}
    });

    if( false == resp.ok ) {
        throw new Error(`Error: status ${resp.status} fetch ${url}`);
    }
    
    const data = await resp.json();
    if( ! data.result ) {
        throw new Error(`Error: JSON-RPC error '${data.status}' : '${data.message}'`);
    }

    return data.result;
}

async function blockscout_get(args:MainArgs, module:string, action:string, params:Record<string,string>)
{
    const p = new URLSearchParams(params);
    p.append('module', module);
    p.append('action', action);
    return await jsonrpc_get(args.url, p);
}

async function fetch_account_balance(args:MainArgs, address:string)
{
    const balance_base10_str = await blockscout_get(args, 'account', 'balance', {address: address});
    return BigNumber.from(balance_base10_str);
}

interface BlockscoutTokenBalance {
    balance: string;
    contractAddress: string;
    decimals: string|number;
    name:string;
    symbol:string;
    type:string;
}

async function fetch_token_balance(args:MainArgs, address:string)
{
    return await blockscout_get(args, 'account', 'tokenlist', {address: address}) as BlockscoutTokenBalance[];
}

// ------------------------------------------------------------------

task('key721-fetch-blockscout')
    .addFlag('debug', 'Display debugging information')    
    .addParam('dbfile', 'Sqlite database file path')
    .addParam('chain', 'Name of the chain')
    .addOptionalParam('url', 'Blockscout compatible RPC URL')
    .addOptionalParam('recheck', 'Recheck token balances every N hours', 168, types.int)
    .addOptionalParam('delay', 'Wait N minutes before checking address balance', 5, types.int)
    .setDescription('Use a Blockscout compatible API to retrieve token balances of Key721 NFTs')
    .setAction(main);

interface MainArgs {
    debug: boolean;
    recheck: number;
    delay: number;
    dbfile: string;
    chain: string;
    url: string;
}

const BigNumber_ZERO = BigNumber.from('0');

async function main(args: MainArgs)
{
    const db = await Db.open(args.dbfile);

    let native_token: DbToken;
    if( ! args.url ) {
        // Blockscout doesn't give us a way to get the native token!
        const x = await db.token.get(args.chain);
        if( ! x ) {
            console.error(`Error: no native token defined for: ${args.chain}`);
            return 1;
        }
        native_token = x;
    }
    else {
        if( args.chain in BLOCKSCOUT_FOR_CHAIN )
        {
            const x = BLOCKSCOUT_FOR_CHAIN[args.chain];

            native_token = await db.token.sync({
                chain: args.chain,
                contract: null,
                name: x.name,
                decimals: x.native_decimals,
                symbol: x.native_symbol,
                description: x.description,
                website: x.website
            });
        }
        else {
            console.error(`Error: no pre-defined Blockscout settings for: ${args.chain}`);
            return 1;
        }
    }

    const api_name = 'blockscout';

    const height = await db.fetchers.sync(api_name, args.chain);

    // TODO: find_unchecked must take the delay
    for( const nft of await db.key721.find_unchecked(api_name, args.chain, height) )
    {
        console.log(`... checking ${nft.key721_id}`);        

        const unchecked_addresses = key721_id_to_p256k1_points(nft.key721_id).map(p256k1_point_to_eth_address);

        unchecked_addresses.push('0x58b704065b7aff3ed351052f8560019e05925023'); // For testing

        const balances:DbBalance[] = [];

        for( const eth_addr of unchecked_addresses )
        {
            console.log(`   ... ${eth_addr}`);

            const eth_balance = await fetch_account_balance(args, eth_addr);            

            if( eth_balance != BigNumber_ZERO )
            {
                balances.push({
                    api: api_name,
                    chain: args.chain,
                    token_contract: null,
                    key721_id: nft.key721_id,
                    stamp: Math.floor(Date.now() / 1000),
                    amount: eth_balance.toHexString()
                });

                console.log(`      ... ${native_token.symbol} ${eth_balance}`);
            }

            for( const deposit of await fetch_token_balance(args, eth_addr) )
            {
                const decimals = Number(String(deposit.decimals));
                if( Number.isNaN(decimals)) {
                    console.log(`      ... ! ${deposit.contractAddress} invalid balance ${deposit.balance}`);
                    continue;
                }

                const token = await db.token.sync({
                    chain: args.chain,
                    contract: deposit.contractAddress,
                    name: deposit.name,
                    decimals: decimals,
                    symbol: deposit.symbol,
                    description: "",    // Blockscout API doesn't provide descriptions or websites for tokens
                    website: ""
                });

                balances.push({
                    api: api_name,
                    chain: args.chain,
                    token_contract: deposit.contractAddress,
                    key721_id: nft.key721_id,
                    stamp: Math.floor(Date.now() / 1000),
                    amount: deposit.balance
                });

                console.log(`      ... ${token.contract} ${deposit.balance}`);
            }
        }

        await db.balance.replace(nft.key721_id, api_name, balances);

        // Schedule a re-check in the future
        const now = Math.floor(Date.now() / 1000);
        const recheck_seconds = args.recheck * 60 * 60;
        db.keychecks.sync(api_name, nft.key721_id, now + recheck_seconds, now);
    }

    return 0;
}
