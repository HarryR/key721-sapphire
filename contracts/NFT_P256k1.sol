// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.9;

import "./ERC721_Sapphire.sol";

contract NFT_P256k1 is ERC721_Sapphire
{
    address private constant GENERAGE_SIGNING_KEYPAIR = 0x0100000000000000000000000000000000000005;

    uint256 private constant Secp256k1PrehashedSha256 = 5;

    function _generate_keypair()
        internal view override
        returns (bytes32 p256k1_public, bytes32 p256k1_secret)
    {
        bytes32 seed = _random_bytes32();

        (bool success, bytes memory keypair) = GENERAGE_SIGNING_KEYPAIR.staticcall(
            abi.encode(Secp256k1PrehashedSha256, abi.encodePacked(seed))
        );

        if( false == success ) revert ErrorGeneratingKeypair();

        (bytes memory publicKey_bytes, bytes memory secretKey_bytes) = abi.decode(keypair, (bytes, bytes));

        p256k1_secret = bytes32(secretKey_bytes);

        // Note: compressed publicKey_bytes is always prefixed with one byte (``0x02`` or ``0x03``)        
        require( 33 == publicKey_bytes.length );

        //p256k1_public = bytes32(publicKey_bytes);

        /// @solidity memory-safe-assembly
        assembly {
            // First 32 bytes = length, remaining 33 bytes = prefix then 32 byte public key
            p256k1_public := mload(add(publicKey_bytes, 33))
        }
    }
}
