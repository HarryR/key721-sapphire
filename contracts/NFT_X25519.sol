// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ERC721_Sapphire.sol";

contract NFT_X25519 is ERC721_Sapphire
{
    function _generate_keypair()
        internal view override
        returns (bytes32 ed25519_public, bytes32 ed25519_secret)
    {
        return _x25519_keypair();
    }
}
