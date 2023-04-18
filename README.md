# Key721 (Sapphire) - Wallet keypairs as NFTs on Oasis

This project wraps keypairs (altbn128, secp256k1, ed25519) as an NFT on Oasis Sapphire, this allows for e.g. Bitcoin wallets to be traded by making a deposit to the NFTs Bitcoin address, the secret key is only revealed to the owner whent the NFT is burned. This acts like a 'bridgeless bridge'.

**Please note: this project is a proof of concept demo, please do not use it or deploy to mainnet as-is, it is part of a larger project and does not offer privacy on its own**

Development is done in a Docker container and uses a local ephemeral Sapphire node.

```shell
make sapphire-dev &  # Start local Sapphire node
make dev-shell       # Ephemeral docker container
> pnpm hardhat test  # Test NFT implementation using OpenZeppelin tests
> make test          # Run mint/burn tests against local Sapphire node
```

Example mint/burn (for Ed25519):

```
> make test-ed25519

>> pnpm hardhat --network sapphire_local key721-mint --alg ed25519 --debug `cat cache/ed25519.address` | tee cache/ed25519-mint.tokenid || rm cache/ed25519-mint.tokenid
       tx: 0x9094187d6e338c74782eb247fd9f0cc11da30bb1442e35d36ef4ca56b4123438 (height: 14309)
 gas used: 143950
  tokenId: 0x93da6509f5e7ac789816070aeacf697e639380f067df373761ec39dcf1a8cfaf
    owner: 0x6052795666b7B062910AaC422b558445F1E4bcC5
[
  {
    oasis: 'oasis1qp2fauyvm5rwtt4d2dgc2w0hy7zzeaxw4y7a8j0v',
    key721_id: '0x93da6509f5e7ac789816070aeacf697e639380f067df373761ec39dcf1a8cfaf'
  }
]
0x93da6509f5e7ac789816070aeacf697e639380f067df373761ec39dcf1a8cfaf

>> pnpm hardhat --network sapphire_local key721-burn --alg ed25519 --debug `cat cache/ed25519.address` `cat cache/ed25519-mint.tokenid`
        tx: 0xaeba12727981efeb7386b6ca18bf1d0a8ad611969adf20145c4ac33cb568708f (height: 14310)
  gas used: 156905
   tokenId: 0x93da6509f5e7ac789816070aeacf697e639380f067df373761ec39dcf1a8cfaf
hex secret: 0x003a4d78aca3d13ab7d4bd04fbe2b317701d8798d4da4781d2546801e73f0852
b64 secret: ADpNeKyj0Tq31L0E++KzF3Adh5jU2keB0lRoAec/CFI=
{
  oasis: 'oasis1qp2fauyvm5rwtt4d2dgc2w0hy7zzeaxw4y7a8j0v',
  key721_id: '0x93da6509f5e7ac789816070aeacf697e639380f067df373761ec39dcf1a8cfaf'
}

```