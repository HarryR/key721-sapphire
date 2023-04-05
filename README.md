# Key721 (Sapphire) - P256k1 keypairs as NFTs on Oasis

This project wraps a P256k1 keypair as an NFT on Oasis Sapphire, this allows for e.g. Bitcoin wallets to be traded by making a deposit to the NFTs Bitcoin address, the secret key is only revealed to the owner whent the NFT is burned.

**Please note: this project is a proof of concept demo, please do not use it or deploy to mainnet as-is, it is part of a larger project and does not offer privacy on its own**

Development is done in a docker container and uses a local ephemeral Sapphire node.

```shell
make sapphire-dev &
make dev-shell
> pnpm hardhat --network sapphire_local test
> make test
```

Example `test` output:

```
> make test

>> pnpm hardhat --network sapphire_local key721-deploy --yes
0xf761B935Ffcb4A729C0A3076791982cc54CD0121

>> pnpm hardhat --network sapphire_local key721-mint `cat cache/deployed.address` | tee cache/mint.tokenid || rm cache/mint.tokenid
0x2b35c840c2ff10ae0fb6bc666e66e41118185c6fb9b7c2cab2d95afa135e0d59

>> pnpm hardhat --network sapphire_local key721-transfer `cat cache/deployed.address` `cat cache/mint.tokenid` 0x6052795666b7B062910AaC422b558445F1E4bcC5 0x6052795666b7B062910AaC422b558445F1E4bcC5
 contract: 0xf761B935Ffcb4A729C0A3076791982cc54CD0121
    owner: 0x6052795666b7B062910AaC422b558445F1E4bcC5
       to: 0x6052795666b7B062910AaC422b558445F1E4bcC5
    token: 0x2b35c840c2ff10ae0fb6bc666e66e41118185c6fb9b7c2cab2d95afa135e0d59
       tx: 0x4322f5cff206d198e388e1097b7698b4675d427e30fbd457c4dbdd5b95b1d02b
      gas: 43412

>> pnpm hardhat --network sapphire_local key721-burn --debug `cat cache/deployed.address` `cat cache/mint.tokenid`
        tx: 0x8eadb30ccd653abd752430e49eb26c270570738920be2131e346a2bf6761755f (height: 15650)
  gas used: 156889
   tokenId: 0x2b35c840c2ff10ae0fb6bc666e66e41118185c6fb9b7c2cab2d95afa135e0d59
    secret: 0x4e20b9c1694189544c81736c654dfa2a558d629597cd36dacc60d7b9e2162b8c
  eth addr: 0x27736Fbd651debaAB75fcaf37BdD2c3Dd7b9C805
{
  eth: '0x27736Fbd651debaAB75fcaf37BdD2c3Dd7b9C805',
  btc: '1BiWdEGUAgcAMNffnv2ve5iyPw9cLz973X',
  segwit: 'bc1qskmksxd9s6ndw3q4qgxncadrdfdjk8jqcmzwtk'
}
{
  eth: '0x653a25cDFAc2Cc117Da027F3379580302e35bD99',
  btc: '1F6zjSuuEXpDvof8uiKAr8To5Q38g1imut',
  segwit: 'bc1qv8aq4zppm0jk6h4qxkdem0g2dr3zsdq47w7hem'
}

>> rm -f cache/mint.tokenid
```