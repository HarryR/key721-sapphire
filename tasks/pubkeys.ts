import { task } from "hardhat/config";
import { ec }  from "elliptic";
import { BigNumber, Wallet } from "ethers";
import { base64, getAddress, hexDataSlice, isHexString, keccak256, sha256, toUtf8Bytes } from "ethers/lib/utils";
import { p2pkh, p2wpkh } from "bitcoinjs-lib/src/payments";

const secp256k1 = new ec("secp256k1");

export function tokenId_to_point(token_id: string | BigNumber)
{
    if( typeof token_id === 'string' ) {
        if( ! token_id.startsWith("0x") ) {
            token_id = BigNumber.from(token_id);
        }
    }

    if( typeof token_id !== 'string' ) {
        token_id = token_id.toHexString().slice(2);
    }
    else {
        if( ! isHexString(token_id, 32) ) {
            throw Error('Token ID must be 32 bytes hex encoded');
        }
        token_id = token_id.slice(2);
    }    

    return [secp256k1.curve.decodePoint("02" + token_id, 'hex'),
            secp256k1.curve.decodePoint("03" + token_id, 'hex')];

    // TODO: move over to a sane typescript friendly curve library instead of 'elliptic'
    // https://github.com/paulmillr/noble-secp256k1
    //import * as secp256k1 from "@noble/secp256k1";
    //return secp256k1.ProjectivePoint.fromHex("0x02" + token_id);
}

export function point_to_eth_address(point:any) {
    const x = point.encode(undefined, false).slice(1); // Includes 0x04 prefix
    return getAddress(hexDataSlice(keccak256(x), 12));
}

export function point_to_btc_address(point:any) {
    const pubkey = Buffer.from(point.encode(undefined, false));
    return p2pkh({ pubkey: pubkey }).address;
}

export function point_to_segwit_address(point:any) {
    const pubkey = Buffer.from(point.encode(undefined, true));
    return p2wpkh({ pubkey: pubkey }).address;   
}

/*
// XXX: Oasis works with ed25519 keypairs, not secp256k1!
import {Keccak} from 'sha3';
import {address as oasis_address} from "@oasisprotocol/client"
import {address as oasisRT_address} from "@oasisprotocol/client-rt"
export async function point_to_oasis_address(point:any) {
    const pk = Buffer.from(point.encode(undefined, true));
    const address = await oasisRT_address.fromSigspec({secp256k1eth: new Uint8Array(pk)});
    return oasisRT_address.toBech32(address);
}
*/

export function point_to_addresses(point:any) {
    return {
        'eth': point_to_eth_address(point),
        'btc': point_to_btc_address(point),
        'segwit': point_to_segwit_address(point),
        //'oasis': await point_to_oasis_address(point),
    }
}

export function p256k1_tokenId_to_addresses(tokenId: string | BigNumber) {
    const p = tokenId_to_point(tokenId);
    return p.map(point_to_addresses);
    //return point_to_addresses(p);
}

task('key721-pubkeys')
    .addOptionalParam('brainseed', 'Derive from brain seed')
    .addOptionalParam('tokenid', 'Token ID provided by NFT contract')
    .setDescription('Calculate public keys')
    .setAction(main);

interface MainArgs {
    brainseed: string | null;
    tokenid: string | null;
}

async function main(args: MainArgs)
{
    let p;

    if( args.tokenid ) {
        p = tokenId_to_point(args.tokenid);        
    }
    else if( args.brainseed ) {
        const n = sha256(toUtf8Bytes(args.brainseed));
        console.log('secret-hex', n);
        console.log('secret-b64', base64.encode(n));
        p = [secp256k1.curve.decodePoint(new Wallet(n).publicKey.slice(2), 'hex')];
    }
    else {
        console.error('Error: must specify either brainseed or tokenid');
        return 1;
    }
    
    for( let i = 0; i < p.length; i++ ) {
        console.log('public-secp256k1', p[i].encode('hex', true));
        console.log('public-eth', point_to_eth_address(p[i]));
        console.log('public-btc', point_to_btc_address(p[i]));
        console.log('public-segwit-bech32', point_to_segwit_address(p[i]));
    }    

    return 0;
}
