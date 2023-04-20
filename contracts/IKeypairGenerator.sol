// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IKeypairGenerator
{
    function generate_keypair() external returns (bytes32 kp_public, bytes32 kp_secret);
}
