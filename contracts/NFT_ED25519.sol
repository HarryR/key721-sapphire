// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.9;

import "./ERC721_Sapphire.sol";

contract NFT_ED25519 is ERC721_Sapphire
{
    address private constant GENERAGE_SIGNING_KEYPAIR = 0x0100000000000000000000000000000000000005;

    uint256 private constant Ed25519Pure = 1;

    function _generate_keypair()
        internal view override
        returns (bytes32 ed25519_public, bytes32 ed25519_secret)
    {
        ed25519_secret = _random_bytes32();

        (bool success, bytes memory keypair) = GENERAGE_SIGNING_KEYPAIR.staticcall(
            abi.encode(Ed25519Pure, abi.encodePacked(ed25519_secret))
        );

        if( false == success ) revert ErrorGeneratingKeypair();

        (bytes memory publicKey_bytes, bytes memory secretKey_bytes) = abi.decode(keypair, (bytes, bytes));

        ed25519_public = bytes32(publicKey_bytes);
    }
}
