import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SupportedCurves, key721_id_to_addresses, secret_to_addresses } from "./pubkeys";
import nacl from 'tweetnacl';
import { sha512_256 } from 'js-sha512';
import { arrayify, keccak256 } from "ethers/lib/utils";
import * as deoxysii from "deoxysii";
import { key721_factory as key721_factory } from "./deploy";

task('key721-burn')
    .addFlag('debug', 'Show debug info')
    .addParam('alg', 'Curve or Algorithm')
    .addPositionalParam("contract", 'Contract address 0x...')
    .addPositionalParam('tokenId', 'Token ID')
    .setDescription('Burn a NFT_p256k1 token')
    .setAction(main);

function x25519_derive_deoxysii(secretKey:Uint8Array, peerPublicKey:Uint8Array) {
    const shared = nacl.scalarMult(secretKey, peerPublicKey);
    return sha512_256.hmac
        .create('MRAE_Box_Deoxys-II-256-128')
        .update(shared)
        .arrayBuffer();
}

function key721_decrypt_reveal(kp:nacl.BoxKeyPair, contract_x25519_public_hex:string, ciphertext_hex:string) {
    const contract_x25519_public = arrayify(contract_x25519_public_hex);
    const ciphertext = arrayify(ciphertext_hex);
    const ephem_derived = x25519_derive_deoxysii(kp.secretKey, contract_x25519_public);
    const nonce = arrayify(keccak256(kp.publicKey)).slice(0, deoxysii.NonceSize);
    var x = new deoxysii.AEAD(new Uint8Array(ephem_derived));
    return x.decrypt(nonce, ciphertext);
}
    
interface MainArgs {
    alg: SupportedCurves;
    debug: boolean;
    contract: string;
    tokenId: string;
}

async function main(args: MainArgs, hre:HardhatRuntimeEnvironment)
{
    const factory = await key721_factory(args.alg, hre);
    const contract = factory.attach(args.contract);

    const kp = nacl.box.keyPair();
    let tx = await contract.burn(args.tokenId, kp.publicKey);
    let receipt = await tx.wait();

    if( args.debug ) {
        console.log(`        tx: ${tx.hash} (height: ${tx.blockNumber})`);
        console.log(`  gas used: ${receipt.gasUsed}`);
    }

    if( receipt.events?.length )
    {
        const tokenId = receipt.events[1].args?.[0];
        const contract_x25519_public = receipt.events[1].args?.[1];
        const ciphertext_hex = receipt.events[1].args?.[2];
        const plaintext_bytes = key721_decrypt_reveal(kp, contract_x25519_public, ciphertext_hex);
        const secret_buffer = Buffer.from(plaintext_bytes);
        const secret_hex = '0x' + secret_buffer.toString('hex');
        const secret_b64 = secret_buffer.toString('base64');

        if( args.debug ) {
            console.log(`   tokenId: ${tokenId}`);
            console.log(`hex secret: ${secret_hex}`);
            console.log(`b64 secret: ${secret_b64}`);
            for( const x of await key721_id_to_addresses(args.alg, tokenId) ) {
                console.log(x);
            }
            for( const x of await secret_to_addresses(args.alg, secret_hex) ) {
                console.log(x);
            }
        }
        else {
            console.log(secret_hex);
        }
    } else {
        console.error(receipt);
    }
}
