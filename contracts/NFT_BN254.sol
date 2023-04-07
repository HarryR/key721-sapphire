// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.9;

import "./ERC721_Sapphire.sol";

contract NFT_BN254 is ERC721_Sapphire
{
    // See: https://hackmd.io/@jpw/bn254

    uint256 private constant BN254_GROUP_ORDER = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001;

    struct BN254_Point {
        uint256 x;
        uint256 y;
    }

    function point_mul(BN254_Point memory p, uint256 s)
        private view
        returns (BN254_Point memory r)
    {
        assembly {
            let location := mload(0x40)
            mstore(location, mload(p))
            mstore(add(location, 0x20), mload(add(p, 0x20)))
            mstore(add(location, 0x40), s)
            if iszero(staticcall(gas(), 0x07, location, 0x60, r, 0x40)) {
                revert(0, 0)
            }
        }
    }

    function point_compress(BN254_Point memory input)
        private pure
        returns (bytes32)
    {
        uint256 result = input.x;

        if (input.y & 0x01 == 0x01) result |= 0x8000000000000000000000000000000000000000000000000000000000000000;

        return bytes32(result);
    }

    function _generate_keypair()
        internal view override
        returns (bytes32 bn254_public, bytes32 bn254_secret)
    {
        bn254_secret = bytes32(uint256(_random_bytes32()) % BN254_GROUP_ORDER);

        bn254_public = point_compress(point_mul(BN254_Point(1,2), uint256(bn254_secret)));
    }
}
