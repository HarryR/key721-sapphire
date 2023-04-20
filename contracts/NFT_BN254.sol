// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Key721.sol";

contract NFT_BN254 is Abstract_Key721
{
    uint256 private constant b3 = 9;
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

    // a - b = c;
    function submod(uint256 x, uint256 y)
        private pure
        returns (uint256)
    {
        unchecked {
            return addmod(x, (P-y), P);
        }
    }

    // https://eprint.iacr.org/2015/1060.pdf
    // Page 13, Sec 4, Algorithm 9: Exception-free point doubling for prime
    // order j-invariant 0 short Weierstrass curves E/Fq : y2 = x3 + b
    function sw_add(
        uint256 X1, uint256 Y1, uint256 Z1,
        uint256 X2, uint256 Y2, uint256 Z2
    )
        private pure
        returns (uint256 X3, uint256 Y3, uint256 Z3)
    {
        unchecked {
            uint256 t0;
            uint256 t1;
            uint256 t2;
            uint256 t3;
            uint256 t4;

            t0 = mulmod(X1, X2, P); // 1. t0 ← X1 · X2
            t1 = mulmod(Y1, Y2, P); // 2. t1 ← Y1 · Y2
            t2 = mulmod(Z1, Z2, P); // 3. t2 ← Z1 · Z2
            t3 = addmod(X1, Y1, P); // 4. t3 ← X1 + Y1
            t4 = addmod(X2, Y2, P); // 5. t4 ← X2 + Y2
            t3 = mulmod(t3, t4, P); // 6. t3 ← t3 · t4
            t4 = addmod(t0, t1, P); // 7. t4 ← t0 + t1
            t3 = submod(t3, t4);    // 8. t3 ← t3 − t4
            t4 = addmod(Y1, Z1, P); // 9. t4 ← Y1 + Z1
            X3 = addmod(Y2, Z2, P); // 10. X3 ← Y2 + Z2
            t4 = mulmod(t4, X3, P); // 11. t4 ← t4 · X3
            X3 = addmod(t1, t2, P); // 12. X3 ← t1 + t2
            t4 = submod(t4, X3);    // 13. t4 ← t4 − X3
            X3 = addmod(X1, Z1, P); // 14. X3 ← X1 + Z1
            Y3 = addmod(X2, Z2, P); // 15. Y3 ← X2 + Z2
            X3 = mulmod(X3, Y3, P); // 16. X3 ← X3 · Y3
            Y3 = addmod(t0, t2, P); // 17. Y3 ← t0 + t2
            Y3 = submod(X3, Y3);    // 18. Y3 ← X3 − Y3
            X3 = addmod(t0, t0, P); // 19. X3 ← t0 + t0
            t0 = addmod(X3, t0, P); // 20. t0 ← X3 + t0
            t2 = mulmod(b3, t2, P); // 21. t2 ← b3 · t2
            Z3 = addmod(t1, t2, P); // 22. Z3 ← t1 + t2
            t1 = submod(t1, t2);    // 23. t1 ← t1 − t2
            Y3 = mulmod(b3, Y3, P); // 24. Y3 ← b3 · Y3
            X3 = mulmod(t4, Y3, P); // 25. X3 ← t4 · Y3
            t2 = mulmod(t3, t1, P); // 26. t2 ← t3 · t1
            X3 = submod(t2, X3);    // 27. X3 ← t2 − X3
            Y3 = mulmod(Y3, t0, P); // 28. Y3 ← Y3 · t0
            t1 = mulmod(t1, Z3, P); // 29. t1 ← t1 · Z3
            Y3 = addmod(t1, Y3, P); // 30. Y3 ← t1 + Y3
            t0 = mulmod(t0, t3, P); // 31. t0 ← t0 · t3
            Z3 = mulmod(Z3, t4, P); // 32. Z3 ← Z3 · t4
            Z3 = addmod(Z3, t0, P); // 33. Z3 ← Z3 + t0
        }
    }

    // https://eprint.iacr.org/2015/1060.pdf
    // Page 13, Sec 4, Algorithm 9: Exception-free point doubling for prime
    // order j-invariant 0 short Weierstrass curves E/Fq : y2 = x3 + b
    function sw_double(
        uint256 X, uint256 Y, uint256 Z
    )
        private pure
        returns(uint256 X3, uint256 Y3, uint256 Z3)
    {
        unchecked {
            uint256 t0;
            uint256 t1;
            uint256 t2;

            t0 = mulmod(Y, Y, P);   // 1. t0 ← Y · Y
            Z3 = addmod(t0, t0, P); // 2. Z3 ← t0 + t0
            Z3 = addmod(Z3, Z3, P); // 3. Z3 ← Z3 + Z3
            Z3 = addmod(Z3, Z3, P); // 4. Z3 ← Z3 + Z3
            t1 = mulmod(Y, Z, P);   // 5. t1 ← Y · Z
            t2 = mulmod(Z, Z, P);   // 6. t2 ← Z · Z
            t2 = mulmod(b3, t2, P); // 7. t2 ← b3 · t2
            X3 = mulmod(t2, Z3, P); // 8. X3 ← t2 · Z3
            Y3 = addmod(t0, t2, P); // 9. Y3 ← t0 + t2
            Z3 = mulmod(t1, Z3, P); // 10. Z3 ← t1 · Z3
            t1 = addmod(t2, t2, P); // 11. t1 ← t2 + t2
            t2 = addmod(t1, t2, P); // 12. t2 ← t1 + t2
            t0 = submod(t0, t2);    // 13. t0 ← t0 − t2
            Y3 = mulmod(t0, Y3, P); // 14. Y3 ← t0 · Y3
            Y3 = addmod(X3, Y3, P); // 15. Y3 ← X3 + Y3
            t1 = mulmod(X, Y, P);   // 16. t1 ← X · Y
            X3 = mulmod(t0, t1, P); // 17. X3 ← t0 · t1
            X3 = addmod(X3, X3, P); // 18. X3 ← X3 + X3
        }
    }

    // Transform from projective to affine coordinates
    function bn254_affine(uint256 x0, uint256 y0, uint256 z0)
        private view
        returns(uint256 x1, uint256 y1)
    {
        unchecked {
            uint256 z0Inv = inverse(z0);
            x1 = mulmod(x0, z0Inv, P);
            y1 = mulmod(y0, z0Inv, P);
        }
    }

    // Multiply an elliptic curve point in a scalar
    function bn254_multiply(uint256 x0, uint256 y0, uint scalar)
        private view
        returns(uint256 x1, uint256 y1)
    {
        require( scalar != 0 );

        unchecked {
            uint256 base2X = x0;
            uint256 base2Y = y0;
            uint256 base2Z = 1;
            uint256 z1 = 1;

            x1 = x0 * (scalar%2);
            y1 = y0 * (scalar%2);

            scalar = scalar >> 1;

            for( uint i = 0; i < 255; i++ ) {
                (base2X, base2Y, base2Z) = sw_double(base2X, base2Y, base2Z);

                (uint256 t_x, uint256 t_y, uint256 t_z) = sw_add(base2X, base2Y, base2Z, x1, y1, z1);

                // Constant time select, if bit is on
                uint256 c = scalar & 1; //scalar % 2;
                uint256 d = 1 - c;
                x1 = (d*x1) + (c*t_x);
                y1 = (d*y1) + (c*t_y);
                z1 = (d*z1) + (c*t_z);

                scalar = scalar >> 1;
            }

            return bn254_affine(x1, y1, z1);
        }
    }

    function point_mul_to_compressed(uint256 p_x, uint256 p_y, uint256 s)
        private view
        returns (uint256)
    {
        unchecked {
            (p_x, p_y) = bn254_multiply(p_x, p_y, s);

            p_x |= ((p_y & 1)<<255);
        }

        return p_x;
    }

    function generate_keypair()
        public view override
        returns (bytes32 bn254_public, bytes32 bn254_secret)
    {
        unchecked {
            bn254_secret = bytes32(_random_uint256_modulo(GENERATOR_ORDER));

            bn254_public = bytes32(point_mul_to_compressed(1, 2, uint256(bn254_secret)));

            require( bn254_public != bytes32(0) );
        }
    }
}
