// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ERC721_Sapphire.sol";

// Note: Sapphire doesn't support BN254 operations... so we have to do it the slow way!
// Note: this is close to constant time, but gas cost of mint() will leak a small amount of information about the secret
// See: https://hackmd.io/@jpw/bn254
// See: https://eips.ethereum.org/EIPS/eip-196
// See: https://github.com/orbs-network/elliptic-curve-solidity
// See: https://github.com/alembic-tech/P256-verify-signature/
// See: https://eprint.iacr.org/2015/1060.pdf (Complete addition formulas for prime order elliptic curves)
contract NFT_BN254 is ERC721_Sapphire
{
    uint256 private constant a = 0;
    uint256 private constant b = 3;
    uint256 private constant GENERATOR_ORDER = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001;
    uint256 private constant P = 0x30644E72E131A029B85045B68181585D97816A916871CA8D3C208C16D87CFD47;

    // Saves about 2000 gas
    function inverse(uint256 x)
        public view
        returns (uint256 result)
    {
        bool success;
        assembly {
            let freemem := mload(0x40)
            mstore(freemem, 0x20)
            mstore(add(freemem,0x20), 0x20)
            mstore(add(freemem,0x40), 0x20)
            mstore(add(freemem,0x60), x)
            mstore(add(freemem,0x80), sub(P, 2))
            mstore(add(freemem,0xA0), P)
            success := staticcall(gas(), 5, freemem, 0xC0, freemem, 0x20)
            result := mload(freemem)
        }
        require(success);
    }

    // Double an elliptic curve point
    // https://www.nayuki.io/page/elliptic-curve-point-addition-in-projective-coordinates
    function bn254_twice_proj(uint256 x0, uint256 y0, uint256 z0)
        internal pure
        returns(uint256 x1, uint256 y1, uint256 z1)
    {
        uint256 t;
        uint256 u;
        uint256 v;
        uint256 w;

        if(x0 == 0 && y0 == 0) {
            return (0,0,1);
        }

        unchecked{
            u = mulmod(y0, z0, P);
            u = mulmod(u, 2, P);

            v = mulmod(u, x0, P);
            v = mulmod(v, y0, P);
            v = mulmod(v, 2, P);

            x0 = mulmod(x0, x0, P);
            t = mulmod(x0, 3, P);
            // comment in this section iff a == 0 (to save gas)
            z0 = mulmod(z0, z0, P);
            z0 = mulmod(z0, a, P);
            t = addmod(t, z0, P);
            // comment up to here if a == 0

            w = mulmod(t, t, P);
            x0 = mulmod(2, v, P);
            w = addmod(w, P-x0, P);

            x0 = addmod(v, P-w, P);
            x0 = mulmod(t, x0, P);
            y0 = mulmod(y0, u, P);
            y0 = mulmod(y0, y0, P);
            y0 = mulmod(2, y0, P);
            y1 = addmod(x0, P-y0, P);

            x1 = mulmod(u, w, P);

            z1 = mulmod(u, u, P);
            z1 = mulmod(z1, u, P);
        }
    }

    // Add elliptic curve points
    // https://www.nayuki.io/page/elliptic-curve-point-addition-in-projective-coordinates
    function bn254_add_proj(uint256 x0, uint256 y0, uint256 z0,
                            uint256 x1, uint256 y1, uint256 z1)
        private pure
        returns(uint256 x2, uint256 y2, uint256 z2)
    {
        uint256 t0;
        uint256 t1;
        uint256 u0;
        uint256 u1;

        if (x0 == 0 && y0 == 0) {
            return (x1, y1, z1);
        }
        else if (x1 == 0 && y1 == 0) {
            return (x0, y0, z0);
        }

        unchecked {
            t0 = mulmod(y0, z1, P);
            t1 = mulmod(y1, z0, P);

            u0 = mulmod(x0, z1, P);
            u1 = mulmod(x1, z0, P);

            if (u0 == u1) {
                if (t0 == t1) {
                    return bn254_twice_proj(x0, y0, z0);
                }
                else {
                    return (0,0,1);
                }
            }

            (x2, y2, z2) = bn254_add_proj2(mulmod(z0, z1, P), u0, u1, t1, t0);
        }
    }

    // An help function to split addProj so it won't have too many local variables
    function bn254_add_proj2(uint256 v, uint256 u0, uint256 u1,
                             uint256 t1, uint256 t0)
        private pure
        returns(uint256 x2, uint256 y2, uint256 z2)
    {
        uint256 u;
        uint256 u2;
        uint256 u3;
        uint256 w;
        uint256 t;

        unchecked {
            t = addmod(t0, P-t1, P);
            u = addmod(u0, P-u1, P);
            u2 = mulmod(u, u, P);

            w = mulmod(t, t, P);
            w = mulmod(w, v, P);
            u1 = addmod(u1, u0, P);
            u1 = mulmod(u1, u2, P);
            w = addmod(w, P-u1, P);

            x2 = mulmod(u, w, P);

            u3 = mulmod(u2, u, P);
            u0 = mulmod(u0, u2, P);
            u0 = addmod(u0, P-w, P);
            t = mulmod(t, u0, P);
            t0 = mulmod(t0, u3, P);

            y2 = addmod(t, P-t0, P);

            z2 = mulmod(u3, v, P);
        }
    }

    // Transform from projective to affine coordinates
    function bn254_affine(uint256 x0, uint256 y0, uint256 z0)
        private view
        returns(uint256 x1, uint256 y1)
    {
        uint256 z0Inv = inverse(z0);
        x1 = mulmod(x0, z0Inv, P);
        y1 = mulmod(y0, z0Inv, P);
    }

    // Multiply an elliptic curve point in a scalar
    function bn254_multiply(uint256 x0, uint256 y0, uint scalar)
        private view
        returns(uint256 x1, uint256 y1)
    {
        require( scalar != 0 );

        if (scalar == 1) {
            return (x0, y0);
        }

        uint256 base2X = x0;
        uint256 base2Y = y0;
        uint256 base2Z = 1;
        uint256 z1 = 1;
        x1 = x0 * (scalar%2);
        y1 = y0 * (scalar%2);

        unchecked {
            scalar = scalar >> 1;

            for( uint i = 0; i < 255; i++ ) {
                (base2X, base2Y, base2Z) = bn254_twice_proj(base2X, base2Y, base2Z);

                (uint256 t_x, uint256 t_y, uint256 t_z) = bn254_add_proj(base2X, base2Y, base2Z, x1, y1, z1);
                uint256 c = scalar % 2;
                uint256 d = 1 - c;
                x1 = (d*x1) + (c*t_x);
                y1 = (d*y1) + (c*t_y);
                z1 = (d*z1) + (c*t_z);

                scalar = scalar >> 1;
            }
        }

        return bn254_affine(x1, y1, z1);
    }

    function point_mul_to_compressed(uint256 p_x, uint256 p_y, uint256 s)
        private view
        returns (uint256)
    {
        (p_x, p_y) = bn254_multiply(p_x, p_y, s);

        if (p_y & 0x01 == 0x01) p_x |= (1<<255);

        return p_x;
    }

    function _generate_keypair()
        internal view override
        returns (bytes32 bn254_public, bytes32 bn254_secret)
    {
        bn254_secret = bytes32(_random_uint256_modulo(GENERATOR_ORDER));

        bn254_public = bytes32(point_mul_to_compressed(1, 2, uint256(bn254_secret)));

        require( bn254_public != bytes32(0) );
    }
}
