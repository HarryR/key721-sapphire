// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.9;

import "./ERC721_Sapphire.sol";

contract NFT_BN254 is ERC721_Sapphire
{
    // Note: Sapphire doesn't support BN254 operations... so we have to do it the slow way!
    // Note: this isn't constant time, gas cost of mint() will leak information about secret
    // See: https://hackmd.io/@jpw/bn254
    // See: https://eips.ethereum.org/EIPS/eip-196
    // See: https://github.com/orbs-network/elliptic-curve-solidity
    // See: https://github.com/alembic-tech/P256-verify-signature/

    uint256 private constant a = 0;

    uint256 private constant b = 3;

    uint256 private constant n = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001;

    uint256 private constant p = 0x30644E72E131A029B85045B68181585D97816A916871CA8D3C208C16D87CFD47;

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
            mstore(add(freemem,0x80), sub(n, 2))
            mstore(add(freemem,0xA0), n)
            success := staticcall(gas(), 5, freemem, 0xC0, freemem, 0x20)
            result := mload(freemem)
        }
        require(success);
    }

    /*
    function inverse(uint256 num)
        private pure
        returns(uint256 invNum)
    {
        uint256 t = 0;
        uint256 newT = 1;
        uint256 r = n;
        uint256 newR = num;
        uint256 q;

        unchecked {
            while (newR != 0) {
                q = r / newR;

                (t, newT) = (newT, addmod(t, (n - mulmod(q, newT,n)), n));
                (r, newR) = (newR, r - q * newR );
            }
        }

        invNum = t;
    }
    */

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
            u = mulmod(y0, z0, n);
            u = mulmod(u, 2, n);

            v = mulmod(u, x0, n);
            v = mulmod(v, y0, n);
            v = mulmod(v, 2, n);

            x0 = mulmod(x0, x0, n);
            t = mulmod(x0, 3, n);
            // comment in this section iff a == 0 (to save gas)
            z0 = mulmod(z0, z0, n);
            z0 = mulmod(z0, a, n);
            t = addmod(t, z0, n);
            // comment up to here if a == 0

            w = mulmod(t, t, n);
            x0 = mulmod(2, v, n);
            w = addmod(w, n-x0, n);

            x0 = addmod(v, n-w, n);
            x0 = mulmod(t, x0, n);
            y0 = mulmod(y0, u, n);
            y0 = mulmod(y0, y0, n);
            y0 = mulmod(2, y0, n);
            y1 = addmod(x0, n-y0, n);

            x1 = mulmod(u, w, n);

            z1 = mulmod(u, u, n);
            z1 = mulmod(z1, u, n);
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
            t0 = mulmod(y0, z1, n);
            t1 = mulmod(y1, z0, n);

            u0 = mulmod(x0, z1, n);
            u1 = mulmod(x1, z0, n);

            if (u0 == u1) {
                if (t0 == t1) {
                    return bn254_twice_proj(x0, y0, z0);
                }
                else {
                    return (0,0,1);
                }
            }

            (x2, y2, z2) = bn254_add_proj2(mulmod(z0, z1, n), u0, u1, t1, t0);
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
            t = addmod(t0, n-t1, n);
            u = addmod(u0, n-u1, n);
            u2 = mulmod(u, u, n);

            w = mulmod(t, t, n);
            w = mulmod(w, v, n);
            u1 = addmod(u1, u0, n);
            u1 = mulmod(u1, u2, n);
            w = addmod(w, n-u1, n);

            x2 = mulmod(u, w, n);

            u3 = mulmod(u2, u, n);
            u0 = mulmod(u0, u2, n);
            u0 = addmod(u0, n-w, n);
            t = mulmod(t, u0, n);
            t0 = mulmod(t0, u3, n);

            y2 = addmod(t, n-t0, n);

            z2 = mulmod(u3, v, n);
        }
    }

    // Transform from projective to affine coordinates
    function bn254_affine(uint256 x0, uint256 y0, uint256 z0)
        private view
        returns(uint256 x1, uint256 y1)
    {
        uint256 z0Inv = inverse(z0);
        x1 = mulmod(x0, z0Inv, n);
        y1 = mulmod(y0, z0Inv, n);
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
        x1 = x0;
        y1 = y0;

        if(scalar%2 == 0) {
            x1 = y1 = 0;
        }

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

            /*
            // This will leak information about the highest bit of the secret
            while(scalar > 0) {
                (base2X, base2Y, base2Z) = bn254_twice_proj(base2X, base2Y, base2Z);

                // If condition not constant time
                //if(scalar%2 == 1) {
                //    (x1, y1, z1) = bn254_add_proj(base2X, base2Y, base2Z, x1, y1, z1);

                // Constant time implementation
                (uint256 t_x, uint256 t_y, uint256 t_z) = bn254_add_proj(base2X, base2Y, base2Z, x1, y1, z1);
                uint256 c = scalar % 2;
                uint256 d = 1 - c;
                x1 = (d*x1) + (c*t_x);
                y1 = (d*y1) + (c*t_y);
                z1 = (d*z1) + (c*t_z);

                scalar = scalar >> 1;
            }
            */
        }

        return bn254_affine(x1, y1, z1);
    }

    function point_mul_to_compressed(uint256 p_x, uint256 p_y, uint256 s)
        private view
        returns (uint256)
    {
        // Sapphire has no bn254 point multiplication builtin
        /*
            uint256[3] memory input = [p_x, p_y, s];

            uint256[2] memory ret;

            bool success;

            assembly {
                success := staticcall(gas(), 7, input, 0x60, ret, 0x40)
            }

            require (success);
        */

        (p_x, p_y) = bn254_multiply(p_x, p_y, s);

        if (p_y & 0x01 == 0x01) p_x |= 0x8000000000000000000000000000000000000000000000000000000000000000;

        return p_x;
    }

    function _generate_keypair()
        internal view override
        returns (bytes32 bn254_public, bytes32 bn254_secret)
    {
        bn254_secret = bytes32(_random_uint256_modulo(n));

        bn254_public = bytes32(point_mul_to_compressed(1, 2, uint256(bn254_secret)));

        require( bn254_public != bytes32(0) );
    }
}
