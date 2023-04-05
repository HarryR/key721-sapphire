//import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { NFT_P256k1 } from "../typechain-types";
import { SigningKey } from "ethers/lib/utils";

describe("NFT_P256k1", () => {
  let onchain : NFT_P256k1;
  let owner : SignerWithAddress;

  before(async () => {
    [owner] = await ethers.getSigners();

    const cf = await ethers.getContractFactory("NFT_P256k1");

    onchain = await cf.deploy();

    await onchain.deployed();

    console.log(`Deployed to ${onchain.address}`);
  });

  describe("Deployment", () => {
    it("Should mint and burn as expected", async () => {
      const mint_receipt = await (await onchain["mint(address)"](owner.address)).wait();
      console.log(`Mint costs ${mint_receipt.gasUsed}`);
      if( mint_receipt.events?.length ) {
        for( let i = 0; i < mint_receipt.events.length; i++ ) {
          const event = mint_receipt.events[i];
          if( event.event == 'RevealSecret' ) {
            // See: https://github.com/ethers-io/ethers.js/blob/main/src.ts/crypto/signing-key.ts
            const N = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");            
            const ski = BigInt(event.args?.p256k1_secret);
            const skin = (BigInt(0) - ski) + N;
            console.log('Skin ' + skin);
            const sk = new SigningKey(event.args?.p256k1_secret);
            const skn = new SigningKey('0x' + skin.toString(16));

            console.log('        Public Key ' + sk.publicKey);
            console.log(' Compressed Public ' + sk.compressedPublicKey);
            console.log('')

            console.log('       Public KeyN ' + skn.publicKey);
            console.log('Compressed PublicN ' + skn.compressedPublicKey);
            console.log('              >n/2 ' + (skin > (N/BigInt(2))))
            console.log('')

            console.log('     Server Public ' + event.args?.p256k1_public);
            console.log('     Server Secret ' + event.args?.p256k1_secret);
            console.log('')

            console.log('        Secret Key ' + sk.privateKey);
            console.log('       Secret KeyN ' + skn.privateKey);            

            console.log(mint_receipt.events[i]);
          }
        }
      }
    });
  });
});
 