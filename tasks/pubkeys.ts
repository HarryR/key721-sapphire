import BN from "bn.js";
import nacl from "tweetnacl";
import { ec, curve }  from "elliptic";
import { BigNumber, BigNumberish, Wallet } from "ethers";
import { getAddress, hexDataSlice, isHexString, keccak256, sha256, toUtf8Bytes } from "ethers/lib/utils";
import { p2pkh, p2wpkh } from "bitcoinjs-lib/src/payments";
import { address as oasisRT_address } from "@oasisprotocol/client-rt"

// ------------------------------------------------------------------

export type SupportedCurves = 'secp256k1' | 'bn254' | 'ed25519' | 'x25519' | 'mock';

export async function key721_id_to_addresses(alg:SupportedCurves, key721_id:string|BigNumber) {
    switch(alg) {
        case 'bn254': return bn254_key721_id_to_addresses(key721_id);
        case 'ed25519': return await ed25519_key721_id_to_addresses(key721_id);
        case 'secp256k1': return p256k1_key721_id_to_addresses(key721_id);
        case 'x25519': return [{key721_id: key721_id}];
        case 'mock': return [{key721_id: key721_id}]
    }
}

export async function secret_to_addresses(alg:SupportedCurves, secret:string) {
    switch(alg) {
        case 'bn254': return bn254_key721_id_to_addresses(bn254_point_to_key721_id(secret_to_bn254_point(secret)));
        case 'secp256k1': return secret_to_p256k1_addresses(secret);
        case 'ed25519': return  ed25519_point_to_addresses(await ed25519_point_from_secret(secret));
        case 'x25519': return await x25519_secret_to_addresses(secret);
        case 'mock': return mock_secret_to_addresses(secret);
    }
}

// ------------------------------------------------------------------

function mock_secret_to_addresses(secret:BigNumberish)
{
    const u256secret = BigNumber.from(secret).toHexString().slice(2).padStart(64, '0');
    const data = new Uint8Array(Buffer.from(u256secret, 'hex'));
    const public_mock = keccak256(data);
    return [{
        key721_id: public_mock
    }];
}

// ------------------------------------------------------------------

export const bn254 = new curve.short({
    p: new BN('30644e72 e131a029 b85045b6 8181585d 97816a91 6871ca8d 3c208c16 d87cfd47', 'hex'),
    a: '0',
    b: '3',
    n: new BN('30644e72 e131a029 b85045b6 8181585d 2833e848 79b97091 43e1f593 f0000001', 'hex'),
    gRed: false
    // XXX: are these necessary? provide a speed increase? idk
    /*,
    beta: '59e26bcea0d48bacd4f263f1acdb5c4f5763473177fffffe',
    lambda: 'b3c4d79d41a917585bfc41088d8daaa78b17ea66b99c90dd',
    */
});

bn254.g = bn254.pointFromX(1);

export type bn254_Point = curve.short.ShortPoint;

export function secret_to_bn254_point(secret:BigNumberish) : bn254_Point {
    const secret_bn = BigNumber.from(secret);
    const x = new BN(secret_bn.toHexString().slice(2), 16);
    return bn254.g.mul(x) as bn254_Point;
}

export function key721_id_to_bn254_point(token_id:string|BigNumberish) {
    const token_bn = BigNumber.from(token_id);
    const x = new BN(token_bn.toHexString().slice(2), 16);
    return bn254.pointFromX(x.maskn(255), x.testn(255)) as bn254_Point;
}

export function bn254_key721_id_to_addresses(token_id:string|BigNumberish) {
    return [ {key721_id: bn254_point_to_key721_id(key721_id_to_bn254_point(token_id))} ]
}

export function bn254_point_to_key721_id(point:bn254_Point) {
    const x = point.getX()
    if( point.getY().testn(0) )  {
        return '0x' + x.bincn(255).toString('hex').padStart(64, '0');
    }
    return '0x' + x.toString('hex').padStart(64, '0');
}

// ------------------------------------------------------------------

export function key721_id_to_ed25519_point(key721_id:BigNumberish) {
    return new Uint8Array(Buffer.from(BigNumber.from(key721_id).toHexString().slice(2), 'hex'));
}

export function ed25519_point_to_key721_id(point:Uint8Array) {
    return BigNumber.from(point).toHexString();
}

export async function ed25519_point_to_oasis_address(point:Uint8Array) {
    const address = await oasisRT_address.fromSigspec({ed25519: point});
    return oasisRT_address.toBech32(address);
}

export async function ed25519_point_to_addresses(point:Uint8Array) {
    return [{
        oasis: await ed25519_point_to_oasis_address(point),
        key721_id: ed25519_point_to_key721_id(point)
    }];
}

export async function ed25519_key721_id_to_addresses(key721_id:BigNumberish) {
    return ed25519_point_to_addresses(key721_id_to_ed25519_point(key721_id));
}

export async function ed25519_point_from_secret(secret: Uint8Array|string) {
    if( typeof secret === 'string' ) {
        if( secret.slice(0,2) != '0x' ) {
            throw Error('Require 0x prefixed hex string');
        }
        secret = new Uint8Array(Buffer.from(secret.slice(2), 'hex'));
    }
    return nacl.sign.keyPair.fromSeed(secret).publicKey;
}

export async function x25519_secret_to_addresses(secret:BigNumberish) {
    const x = new Uint8Array(Buffer.from(BigNumber.from(secret).toHexString().slice(2), 'hex'));
    return [{
        key721_id: '0x' + Buffer.from(nacl.box.keyPair.fromSecretKey(x).publicKey).toString('hex')
    }];
}

// ------------------------------------------------------------------

export const secp256k1 = new ec("secp256k1");

export type p256k1_Point = curve.short.ShortPoint;

export function secret_to_p256k1_point(secret:BigNumberish) : p256k1_Point {
    const secret_bn = BigNumber.from(secret);
    const x = new BN(secret_bn.toHexString().slice(2), 16);
    return secp256k1.g.mul(x) as p256k1_Point;
}

export function secret_to_p256k1_points(secret:BigNumberish) : p256k1_Point[] {
    const p = secret_to_p256k1_point(secret) as p256k1_Point;
    const q = p.neg() as p256k1_Point;
    return [p, q];
}

export function secret_to_p256k1_addresses(secret:BigNumberish) {
    return secret_to_p256k1_points(secret).map(p256k1_point_to_addresses);
}

export function p256k1_point_to_key721_id(point:p256k1_Point) {
    return '0x' + point.getX().toString('hex');
}

export function key721_id_to_p256k1_points(key721_id: string | BigNumber) : [p256k1_Point, p256k1_Point]
{
    if( typeof key721_id === 'string' ) {
        if( ! key721_id.startsWith("0x") ) {
            key721_id = BigNumber.from(key721_id);
        }
    }

    if( typeof key721_id !== 'string' ) {
        key721_id = key721_id.toHexString().slice(2);
    }
    else {
        if( ! isHexString(key721_id, 32) ) {
            throw Error('Token ID must be 32 bytes hex encoded');
        }
        key721_id = key721_id.slice(2);
    }

    return [secp256k1.curve.decodePoint("02" + key721_id, 'hex'),
            secp256k1.curve.decodePoint("03" + key721_id, 'hex')];
}

export function p256k1_point_to_eth_address(point:p256k1_Point) {
    const x = point.encode(undefined, false).slice(1); // Includes 0x04 prefix
    return getAddress(hexDataSlice(keccak256(x), 12));
}

export function p256k1_point_to_btc_address(point:p256k1_Point) {
    const pubkey = Buffer.from(point.encode(undefined, false));
    return p2pkh({ pubkey: pubkey }).address;
}

export function p256k1_point_to_segwit_address(point:p256k1_Point) {
    const pubkey = Buffer.from(point.encode(undefined, true));
    return p2wpkh({ pubkey: pubkey }).address;   
}

export function p256k1_point_to_addresses(point:p256k1_Point) {
    return {
        'secp256k1_xy': point.encode('hex', false),
        'secp256k1_compact': point.encode('hex', true),
        'eth': p256k1_point_to_eth_address(point),
        'btc': p256k1_point_to_btc_address(point),
        'segwit': p256k1_point_to_segwit_address(point)
    }
}

export function p256k1_key721_id_to_addresses(key721_id: string | BigNumber) {
    return key721_id_to_p256k1_points(key721_id).map(p256k1_point_to_addresses);
}

// ------------------------------------------------------------------

try {
    // Task defined this way so pubkeys can be imported outside of hardhat environment
    const { task } = require("hardhat/config");
    task('key721-pubkeys')
        .addPositionalParam('curve', 'Which curve: secp256k1 | bn254 | ed25519', 'secp256k1')
        .addOptionalParam('brainseed', 'Derive from brain seed')
        .addOptionalParam('secrethex', 'Derive from secret (0x prefixed hexadecimal)')
        .addOptionalParam('secretb64', 'Derive from secret (Base64 encoded)')
        .addOptionalParam('tokenid', 'Token ID provided by NFT contract')
        .setDescription('Calculate public keys for Key721')
        .setAction(pubkeys_main);
}
catch( e ) {
    // Ignored
}
interface PubkeysMainArgs {
    curve: SupportedCurves;
    brainseed: string | null;
    tokenid: string | null;
    secrethex: string | null;
    secretb64: string | null;
}

async function pubkeys_main(args: PubkeysMainArgs)
{
    let secret;
    if( args.secrethex || args.secretb64 ) {
        if( args.secrethex ) {
            secret = args.secrethex;
        }
        else if( args.secretb64 ) {
            secret = '0x' + Buffer.from(args.secretb64, 'base64').toString('hex');
        }
    }
    else if( args.brainseed ) {
        // XXX: note this brainseed type is very insecure!
        // TODO: add argon2, pbkdf2
        secret = sha256(toUtf8Bytes(args.brainseed));
    }
    else if( ! args.tokenid ) {
        console.error('Error! Must provide a secret or a token ID')
        return 2;
    }

    if( args.curve == 'secp256k1' )
    {
        let points:p256k1_Point[] = [];
        if( args.tokenid ) {
            points = key721_id_to_p256k1_points(args.tokenid);
        }
        else if( secret ) {
            points = [secp256k1.curve.decodePoint(new Wallet(secret).publicKey.slice(2), 'hex')];
        }

        if( points.length ) {
            for( const p of points ) {
                console.log(p256k1_point_to_addresses(p));
            }
        }

        return 0;
    }
    else if( args.curve == "ed25519" ) {
        let p:Uint8Array|undefined;

        if( args.tokenid ) {
            p = key721_id_to_ed25519_point(args.tokenid);
        }
        else if( secret) {
            p = await ed25519_point_from_secret(secret);
        }

        if( p ) {
            console.log(await ed25519_point_to_addresses(p));
        }

        return 0;
    }
    else if( args.curve == 'bn254' ) {
        const h = bn254.g.mul(new BN('100', 10));
        console.log(h.getX().toString(), h.getY().toString());
        const i = h.encodeCompressed('hex');
        console.log(i);
        const j = bn254.decodePoint(i, 'hex');
        console.log(j.getX().toString(), j.getY().toString());

        return 0;
    }

    console.error(`Error: unknown curve ${args.curve}`);
    return 1;
}
