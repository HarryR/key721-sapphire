import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SupportedCurves, key721_id_to_addresses, secret_to_addresses } from "./pubkeys";
import nacl from 'tweetnacl';
import { sha512_256 } from 'js-sha512';
import { LogDescription, arrayify, keccak256 } from "ethers/lib/utils";
import * as deoxysii from "deoxysii";
import { key721_factory } from "./deploy";
import { TransactionReceipt } from "@ethersproject/providers";
import { entropyToMnemonic } from "bip39";

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

// TODO: remove dependency on HRE, it's not necessary when only decoding the receipt logs
async function key721_decrypt_burn_tx(hre:HardhatRuntimeEnvironment, alg:SupportedCurves, receipt:TransactionReceipt, x25519_secret:Uint8Array)
{
    if( ! receipt.logs.length )
    {
        throw Error('Could not decode burn transaction events');
    }
    
    const factory = await key721_factory(alg, hre);
    let events:LogDescription[] = [];
    for( const x of receipt.logs ) {
        const y = factory.interface.parseLog(x);
        events.push(y);
    }

    const reveal_idx = events.findIndex((e) => e.name == 'RevealSecret');
    if( reveal_idx == -1 ) {
        throw Error('Unable to find RevealSecret event in receipt!')
    }

    const reveal = events[reveal_idx];
    const tokenId = reveal.args[0];
    const contract_x25519_public = reveal.args[1];
    const ciphertext_hex = reveal.args[2];

    const kp = nacl.box.keyPair.fromSecretKey(x25519_secret);
    const plaintext_bytes = key721_decrypt_reveal(kp, contract_x25519_public, ciphertext_hex);

    return {
        alg: alg,
        key721_id: tokenId,
        secret_bytes: plaintext_bytes,
    }
}

// ------------------------------------------------------------------

try {
    // Task defined this way so pubkeys can be imported outside of hardhat environment
    const { task } = require("hardhat/config");
    task('key721-burn')
        .addFlag('debug', 'Show debug info')
        .addParam('alg', 'Curve or Algorithm')
        .addOptionalParam('tx', 'Decode an existing transaction')
        .addOptionalParam('x25519', 'Hex encoded secret used to decrypt burn tx response')
        .addOptionalParam('tokenid', 'Token ID')
        .addParam("contract", 'Contract address 0x...')
        .setDescription('Burn a NFT_p256k1 token')
        .setAction(burn_main);
} catch(e) {}

interface BurnMainArgs {
    alg: SupportedCurves;
    debug: boolean;
    contract: string;
    tokenid: string;
    tx: string | undefined;
    x25519: string | undefined
}

async function burn_main(args: BurnMainArgs, hre:HardhatRuntimeEnvironment)
{
    const factory = await key721_factory(args.alg, hre);
    const contract = factory.attach(args.contract);

    let receipt: TransactionReceipt;
    let kp : nacl.BoxKeyPair;

    if( ! args.tx ) {
        kp = nacl.box.keyPair();
        const tx = await contract["burn(bytes32,bytes32)"](args.tokenid, kp.publicKey);
        receipt = await tx.wait();
    }
    else {
        if( ! args.x25519 ) {
            throw Error('Must provide x25519 secret used to decode event');
        }
        const tmp = new Uint8Array(Buffer.from(args.x25519.slice(2), 'hex'));
        kp = nacl.box.keyPair.fromSecretKey(tmp);
        receipt = await contract.provider.getTransactionReceipt(args.tx);
    }

    if( args.debug ) {
        console.error(`        tx: ${receipt.transactionHash} (height: ${receipt.blockNumber})`);
        console.error(`  gas used: ${receipt.gasUsed}`);
    }

    if( ! receipt.logs.length ) {
        console.log('Receipt:', receipt);
        throw Error('Burn failed');
    }

    const result = await key721_decrypt_burn_tx(hre, args.alg, receipt, kp.secretKey);
    if( result )
    {
        const secret_buffer = Buffer.from(result.secret_bytes);
        const secret_hex = '0x' + secret_buffer.toString('hex');
        const secret_b64 = secret_buffer.toString('base64');
        const x25519_hex = Buffer.from(kp.secretKey).toString('hex');
        const secret_mnemonic = entropyToMnemonic(secret_buffer);

        if( args.debug ) {
            console.error(`   tokenId: ${result.key721_id}`);
            console.error();
            console.error('----------- addresses ---------');
            for( const x of await secret_to_addresses(args.alg, secret_hex) ) {
                for( const [k,v] of Object.entries(x) ) {
                    console.error(' ', k, v);
                }
            }

            console.error();
            console.error('----------- secrets -----------');
            console.error(`     bip39: ${secret_mnemonic}`);
            console.error(`hex secret: ${secret_hex}`);
            console.error(`b64 secret: ${secret_b64}`);
            console.error(`    x25519: 0x${x25519_hex}`);
            console.error();
        }

        console.log(secret_hex);
        return 0;
    }

    console.error('Receipt:', receipt);
    throw Error('Cannot decode burn transaction');
}
