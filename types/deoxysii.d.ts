declare module "deoxysii"
{
    const KeySize:number;
    const NonceSize:number;
    const TagSize:number;

    export class AEAD {
        constructor(key:Uint8Array, useUnsafeVartime:bool=false);
        public encrypt(nonce:Uint8Array, plaintext:Uint8Array|null=null, associatedData:Uint8Array|null=null) : Uint8Array; 
        public decrypt(nonce:Uint8Array, ciphertext:Uint8Array, associatedData:Uint8Array|null=null) : Uint8Array;
    }
}