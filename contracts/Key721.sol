// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ERC721.sol";
import "./IKeypairGenerator.sol";

abstract contract Abstract_Key721 is Abstract_ERC721, IKeypairGenerator
{
    using Address for address;

    event PublicKey(bytes32 x25519_public);

    event RevealSecret(bytes32 p256k1_public, bytes32 contract_x25519_public, bytes ciphertext);

    mapping(bytes32 => bytes32) internal m_keypairs;

    bytes32 private m_public_x25519;

    bytes32 private m_secret_x25519;

    function generate_keypair() public virtual returns (bytes32 kp_public, bytes32 kp_secret);

    constructor ()
    {
        (m_public_x25519, m_secret_x25519) = _x25519_keypair();

        emit PublicKey(m_public_x25519);
    }

    function emitPublicKey()
        external
    {
        emit PublicKey(m_public_x25519);
    }

    function burn(bytes32 token_id)
        public
        returns (bytes32)
    {
        bytes32 secret = m_keypairs[token_id];

        if( secret == bytes32(0) ) {
            revert Error_ERC721_Invalid_Token_ID();
        }

        if( msg.sender != _owners[uint256(token_id)] ) {
            revert Error_ERC721_WrongOwner();
        }

        _burn(uint256(token_id));

        return secret;
    }

    function burn(bytes32 token_id, bytes32 ephemeral_x25519_public)
        external
    {
        bytes32 secret = burn(token_id);

        bytes32 key = _x25519_derive(ephemeral_x25519_public, m_secret_x25519);

        bytes32 IV = keccak256(abi.encodePacked(ephemeral_x25519_public));

        bytes memory response = _encrypt(key, IV, abi.encodePacked(secret), new bytes(0));

        emit RevealSecret(token_id, m_public_x25519, response);
    }

    function mint()
        external
        returns (bytes32)
    {
        return mint(msg.sender);
    }

    function mint(address to)
        public
        returns (bytes32)
    {
        (bytes32 kp_public, bytes32 kp_secret) = generate_keypair();

        require( kp_public != 0 );

        m_keypairs[kp_public] = kp_secret;

        _mint(to, uint256(kp_public));

        return kp_public;
    }

    function safeMint(address to)
        public
        returns (bytes32)
    {
        return safeMint(to, "");
    }

    function safeMint(address to, bytes memory data)
        public
        returns (bytes32 tokenId)
    {
        tokenId = mint(to);

        _checkOnERC721Received(address(0), to, uint256(tokenId), data);
    }

// ------------------------------------------------------------------
// Sapphire-specific library functions

    address private constant MODEXP_BUILTIN = 0x0000000000000000000000000000000000000005;

    address private constant RANDOM_BYTES = 0x0100000000000000000000000000000000000001;

    address private constant DERIVE_KEY = 0x0100000000000000000000000000000000000002;

    address private constant ENCRYPT = 0x0100000000000000000000000000000000000003;

    address private constant CURVE25519_PUBLIC_KEY = 0x0100000000000000000000000000000000000008;

    error ErrorGeneratingRandom();

    error ErrorReducingRandom();

    error ErrorGeneratingKeypair();

    error ErrorDerivingKey();

    error ErrorEncrypting();

    function _x25519_derive(bytes32 ephemeral_x25519_public, bytes32 secret)
        private view
        returns (bytes32 ephemeral_derived)
    {
        (bool success, bytes memory derived) = DERIVE_KEY.staticcall(
            abi.encode(ephemeral_x25519_public, secret)
        );

        if( false == success ) revert ErrorDerivingKey();

        ephemeral_derived = bytes32(derived);
    }

    function _encrypt(bytes32 key, bytes32 nonce, bytes memory plaintext, bytes memory additionalData)
        private view
        returns (bytes memory)
    {
        (bool success, bytes memory ciphertext) = ENCRYPT.staticcall(
            abi.encode(key, nonce, plaintext, additionalData)
        );

        if( false == success ) revert ErrorEncrypting();

        return ciphertext;
    }

    // Sample 64 bytes of entropy before reducing to avoid modulo bias
    // Using: modexp(random_bytes(64), 1, modulus)
    // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-198.md
    function _random_uint256_modulo(uint256 modulus)
        internal view
        returns (uint256)
    {
        (bool success, bytes memory entropy) = RANDOM_BYTES.staticcall(
            abi.encode(uint256(64), abi.encodePacked(block.chainid, block.number, block.timestamp, msg.sender, address(this)))
        );

        if( false == success ) revert ErrorGeneratingRandom();

        bytes32 entropy_a;
        bytes32 entropy_b;

        assembly {
            entropy_a := mload(add(entropy, 0x20))
            entropy_b := mload(add(entropy, 0x40))
        }

        (success, entropy) = MODEXP_BUILTIN.staticcall(
            abi.encodePacked(
                uint256(0x40),  // length_of_BASE
                uint256(1),     // length_of_EXPONENT
                uint256(0x20),  // length_of_MODULUS
                entropy_a,
                entropy_b,
                uint8(1),       // EXPONENT
                modulus         // MODULUS
            ));

        if( false == success ) revert ErrorReducingRandom();

        return uint256(bytes32(entropy));
    }

    function _random_bytes32()
        internal view
        returns (bytes32)
    {
        // TODO: perform rejection sampling until result is below scalar modulus?
        //       without this a modulo reduction will introduce bias in generated secrets
        //  e.g. with bn254 there will be a ~18% bias towards the first 33% (252 bits) of the range (0,n)
        // or... generate 64 bytes and perform `modexp(n,1,m)` to reduce modulo `m`

        // XXX: is personalization necessary here?
        bytes memory p13n = abi.encodePacked(block.chainid, block.number, block.timestamp, msg.sender, address(this));

        (bool success, bytes memory entropy) = RANDOM_BYTES.staticcall(
            abi.encode(uint256(32), p13n)
        );

        if( false == success ) revert ErrorGeneratingRandom();

        return bytes32(entropy);
    }

    function _x25519_keypair()
        internal view
        returns (bytes32 x25519_public, bytes32 x25519_secret)
    {
        x25519_secret = _random_bytes32();

        require( 0 != uint256(x25519_secret) );

        (bool success, bytes memory public_bytes) = CURVE25519_PUBLIC_KEY.staticcall(abi.encodePacked(x25519_secret));

        if( false == success ) revert ErrorGeneratingKeypair();

        x25519_public = bytes32(public_bytes);
    }
}
