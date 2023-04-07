import { task } from "hardhat/config";
import BN from "bn.js";
import { ec, curve }  from "elliptic";
import { BigNumber, Wallet } from "ethers";
import { base64, getAddress, hexDataSlice, isHexString, keccak256, sha256, toUtf8Bytes } from "ethers/lib/utils";
import { p2pkh, p2wpkh } from "bitcoinjs-lib/src/payments";

// ------------------------------------------------------------------

const bn254 = new curve.short({
    p: new BN('30644e72 e131a029 b85045b6 8181585d 97816a91 6871ca8d 3c208c16 d87cfd47', 'hex'),
    a: '0',
    b: '3',
    n: new BN('30644e72 e131a029 b85045b6 8181585d 2833e848 79b97091 43e1f593 f0000001', 'hex'),
    gRed: false,
    beta: '59e26bcea0d48bacd4f263f1acdb5c4f5763473177fffffe',
    lambda: 'b3c4d79d41a917585bfc41088d8daaa78b17ea66b99c90dd',
});

bn254.g = bn254.pointFromX(1);

type bn254_Point = curve.short.ShortPoint;

export function key721_id_to_bn254_point(token_id: string) {
    return bn254.decodePoint(token_id) as bn254_Point;
}

// ------------------------------------------------------------------

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

// ------------------------------------------------------------------

const secp256k1 = new ec("secp256k1");

type p256p1_Point = curve.short.ShortPoint;

export function key721_id_to_p256k1_points(token_id: string | BigNumber) : [p256p1_Point, p256p1_Point]
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

export function p256k1_point_to_eth_address(point:p256p1_Point) {
    const x = point.encode(undefined, false).slice(1); // Includes 0x04 prefix
    return getAddress(hexDataSlice(keccak256(x), 12));
}

export function p256k1_point_to_btc_address(point:p256p1_Point) {
    const pubkey = Buffer.from(point.encode(undefined, false));
    return p2pkh({ pubkey: pubkey }).address;
}

export function p256k1_point_to_segwit_address(point:p256p1_Point) {
    const pubkey = Buffer.from(point.encode(undefined, true));
    return p2wpkh({ pubkey: pubkey }).address;   
}

export function p256k1_point_to_addresses(point:p256p1_Point) {
    return {
        'eth': p256k1_point_to_eth_address(point),
        'btc': p256k1_point_to_btc_address(point),
        'segwit': p256k1_point_to_segwit_address(point),
        //'oasis': await point_to_oasis_address(point),
    }
}

export function p256k1_key721_id_to_addresses(tokenId: string | BigNumber) {
    const p = key721_id_to_p256k1_points(tokenId);
    return p.map(p256k1_point_to_addresses);
    //return point_to_addresses(p);
}

// ------------------------------------------------------------------

task('key721-pubkeys')
    .addOptionalParam('curve', 'Which curve: secp256k1 | bn254 | ed25519', 'secp256k1')
    .addOptionalParam('brainseed', 'Derive from brain seed')
    .addOptionalParam('tokenid', 'Token ID provided by NFT contract')
    .setDescription('Calculate public keys')
    .setAction(main);

interface MainArgs {
    curve: string;
    brainseed: string | null;
    tokenid: string | null;
}

async function main(args: MainArgs)
{
    let p;

    if( args.curve == 'secp256k1' )
    {
        if( args.tokenid ) {
            p = key721_id_to_p256k1_points(args.tokenid);        
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
            console.log('public-eth', p256k1_point_to_eth_address(p[i]));
            console.log('public-btc', p256k1_point_to_btc_address(p[i]));
            console.log('public-segwit-bech32', p256k1_point_to_segwit_address(p[i]));
        }
    }
    else if( args.curve == 'bn254' ) {
        const h = bn254.g.mul(new BN('100', 10));
        console.log(h.getX().toString(), h.getY().toString());
        const i = h.encodeCompressed('hex');
        console.log(i);
        const j = bn254.decodePoint(i, 'hex');
        console.log(j.getX().toString(), j.getY().toString());
    }
    else {
        console.error(`Error: unknown curve ${args.curve}`);
        return 1;
    }

    return 0;
}
