// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../Key721.sol";

contract MockKey721 is Abstract_Key721 {
    uint256 public nonce;

    function generate_keypair()
        public override
        returns (bytes32 kp_public, bytes32 kp_secret)
    {        
        kp_secret = keccak256(abi.encodePacked(nonce));
        kp_public = keccak256(abi.encodePacked(kp_secret));
        nonce += 1;
    }
}
