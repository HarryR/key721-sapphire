// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.9;

import "./ERC721_Sapphire.sol";

contract NFT_ED25519 is ERC721_Sapphire
{
    address private constant GENERAGE_SIGNING_KEYPAIR = 0x0100000000000000000000000000000000000005;

    uint256 private constant Ed25519Pure = 1;

    uint256 private constant Ed25519_Group_Order = 0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed;

    function _generate_keypair()
        internal view override
        returns (bytes32 ed25519_public, bytes32 ed25519_secret)
    {
        bytes memory secret_bytes = abi.encodePacked(_random_uint256(Ed25519_Group_Order));
        // While this isn't necessary, ensure the secret is in its canonical form
        secret_bytes[0] &= 0xf8; // Make it a multiple of 8 to avoid small subgroup attacks.
        secret_bytes[31] &= 0x7f; // Clamp to < 2^255 - 19
        secret_bytes[31] |= 0x40; // Clamp to >= 2^254

        (bool success, bytes memory keypair) = GENERAGE_SIGNING_KEYPAIR.staticcall(
            abi.encode(Ed25519Pure, secret_bytes)
        );

        if( false == success ) revert ErrorGeneratingKeypair();

        // Result of secretKey_bytes are ignored here as they're not useful (a SHA-512 hash of secret for X25519 key)
        (bytes memory publicKey_bytes, bytes memory secretKey_bytes) = abi.decode(keypair, (bytes, bytes));

        ed25519_public = bytes32(publicKey_bytes);

        ed25519_secret = bytes32(secret_bytes);
    }
}
