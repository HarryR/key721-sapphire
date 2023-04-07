// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/Address.sol";

abstract contract ERC721_Sapphire is IERC721
{
    using Address for address;

    event PublicKey(bytes32 x25519_public);

    event RevealSecret(bytes32 p256k1_public, bytes32 contract_x25519_public, bytes ciphertext);

    error NotAuthorized();
    error BadOperator();
    error WrongOwner();
    error NotFound();
    error CannotApproveToOwner();
    error NotApproved();
    error AlreadyExists();

    mapping(bytes32 => bytes32) internal m_keypairs;

    bytes32 private m_public_x25519;

    bytes32 private m_secret_x25519;

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

    function burn(bytes32 token_id, bytes32 ephemeral_x25519_public)
        external
    {
        bytes32 secret = m_keypairs[token_id];

        if( secret == bytes32(0) ) revert NotFound();

        if( msg.sender != _owners[uint256(token_id)] ) revert WrongOwner();

        _burn(uint256(token_id));

        bytes32 key = _x25519_derive(ephemeral_x25519_public, m_secret_x25519);

        bytes32 IV = keccak256(abi.encodePacked(ephemeral_x25519_public));

        bytes memory response = _encrypt(key, IV, abi.encodePacked(secret), new bytes(0));

        emit RevealSecret(token_id, m_public_x25519, response);
    }

    function _generate_keypair() internal view virtual returns (bytes32 kp_public, bytes32 kp_secret);

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
        (bytes32 kp_public, bytes32 kp_secret) = _generate_keypair();

        m_keypairs[kp_public] = kp_secret;

        _mint(to, uint256(kp_public));

        return kp_public;
    }

// ------------------------------------------------------------------
// Sapphire-specific library functions

    address private constant RANDOM_BYTES = 0x0100000000000000000000000000000000000001;

    address private constant DERIVE_KEY = 0x0100000000000000000000000000000000000002;

    address private constant ENCRYPT = 0x0100000000000000000000000000000000000003;

    address private constant CURVE25519_PUBLIC_KEY = 0x0100000000000000000000000000000000000008;

    error ErrorGeneratingRandom();

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

    function _random_bytes32()
        internal view
        returns (bytes32)
    {
        // XXX: is personalization really necessary here?
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

// ------------------------------------------------------------------
// ERC-721 Implementation
// Taken from OpenZeppelin implementation, unnecessary bits removed as it exceeds gas limit when deploying
// OpenZeppelin: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/ERC721.sol
// Spec: https://eips.ethereum.org/EIPS/eip-721

    mapping(uint256 => address) private _owners;

    mapping(address => uint256) private _balances;

    mapping(uint256 => address) private _tokenApprovals;

    mapping(address => mapping(address => bool)) private _operatorApprovals;

    function _mint(address to, uint256 tokenId)
        internal
    {
        if( address(0) != _owners[tokenId] ) revert AlreadyExists();

        _balances[to] += 1;

        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }

    function _burn(uint256 tokenId)
        private
    {
        address owner = _owners[tokenId];
        
        if( address(0) == owner ) revert NotFound();

        delete _tokenApprovals[tokenId];

        _balances[owner] -= 1;

        delete _owners[tokenId];

        emit Transfer(owner, address(0), tokenId);
    }

    function setApprovalForAll(address operator, bool approved)
        external
    {
        if( msg.sender == operator ) revert BadOperator();

        _operatorApprovals[msg.sender][operator] = approved;

        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function getApproved(uint256 tokenId)
        public view 
        returns (address)
    {
        if( address(0) == _owners[tokenId] ) revert NotFound();

        return _tokenApprovals[tokenId];
    }

    function safeTransferFrom(address from, address to, uint256 tokenId)
        external
    {
        safeTransferFrom(from, to, tokenId, "");
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId)
        private view
        returns (bool)
    {
        address owner = _owners[tokenId];
        
        if( address(0) == owner ) revert NotFound();

        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data)
        public
    {
        if( false == _isApprovedOrOwner(msg.sender, tokenId) ) revert NotApproved();

        _transfer(from, to, tokenId);

        require( _checkOnERC721Received(from, to, tokenId, data) );
    }

    function transferFrom(address from, address to, uint256 tokenId)
        external
    {
        if( false == _isApprovedOrOwner(msg.sender, tokenId) ) revert NotApproved();

        _transfer(from, to, tokenId);
    }

    function _transfer(address from, address to, uint256 tokenId)
        private
    {
        if( _owners[tokenId] != from ) revert WrongOwner();

        delete _tokenApprovals[tokenId];

        _balances[from] -= 1;

        _balances[to] += 1;

        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    )
        private
        returns (bool)
    {
        if (to.isContract())
        {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            }
            catch (bytes memory reason)
            {
                if ( 0 == reason.length ) {
                    revert();
                }
                /// @solidity memory-safe-assembly
                assembly {
                    revert(add(32, reason), mload(reason))
                }
            }
        }

        return true;
    }

    function supportsInterface(bytes4 interfaceId)
        external pure
        returns (bool) 
    {
        return interfaceId == type(IERC721).interfaceId;
    }

    function ownerOf(uint256 tokenId)
        external view
        returns (address)
    {
        address owner = _owners[tokenId];

        if( address(0) == owner ) revert NotFound();

        return owner;
    }

    function approve(address to, uint256 tokenId)
        external
    {
        address owner = _owners[tokenId];

        if( address(0) == owner ) revert NotFound();

        if( to == owner ) revert CannotApproveToOwner();

        require( msg.sender == owner || isApprovedForAll(owner, msg.sender) );

        _tokenApprovals[tokenId] = to;

        emit Approval(owner, to, tokenId);
    }

    function isApprovedForAll(address owner, address operator)
        public view
        returns (bool)
    {
        return _operatorApprovals[owner][operator];
    }

    function balanceOf(address owner)
        external view
        returns (uint256) 
    {
        return _balances[owner];
    }
}