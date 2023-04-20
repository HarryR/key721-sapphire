// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Key721.sol";

contract NFT_P256k1 is Abstract_Key721
{
    address private constant GENERAGE_SIGNING_KEYPAIR = 0x0100000000000000000000000000000000000005;

    uint256 private constant Secp256k1PrehashedSha256 = 5;

    uint256 private constant Secp256k1_Curve_Order = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function generate_keypair()
        public view override
        returns (bytes32 p256k1_public, bytes32 p256k1_secret)
    {
        bytes32 seed = bytes32(_random_uint256_modulo(Secp256k1_Curve_Order));

        (bool success, bytes memory keypair) = GENERAGE_SIGNING_KEYPAIR.staticcall(
            abi.encode(Secp256k1PrehashedSha256, abi.encodePacked(seed))
        );

        if( false == success ) revert ErrorGeneratingKeypair();

        (bytes memory publicKey_bytes, bytes memory secretKey_bytes) = abi.decode(keypair, (bytes, bytes));

        p256k1_secret = bytes32(secretKey_bytes);

        // Note: compressed publicKey_bytes is always prefixed with one byte (``0x02`` or ``0x03``)        
        require( 33 == publicKey_bytes.length );

        /// @solidity memory-safe-assembly
        assembly {
            // First 32 bytes = length, remaining 33 bytes = prefix then 32 byte public key
            p256k1_public := mload(add(publicKey_bytes, 33))
        }
    }
}
