// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Key721.sol";

contract NFT_X25519 is Abstract_Key721
{
    function generate_keypair()
        public view override
        returns (bytes32 ed25519_public, bytes32 ed25519_secret)
    {
        return _x25519_keypair();
    }
}
