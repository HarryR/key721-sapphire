// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

// ERC-721 Implementation
// Taken from OpenZeppelin implementation, unnecessary bits removed as it exceeds gas limit when deploying
// OpenZeppelin: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/ERC721.sol
// Spec: https://eips.ethereum.org/EIPS/eip-721

abstract contract Abstract_ERC721 is IERC721, ERC165
{
    using Address for address;

    error Error_ERC721_Approve_To_Caller();
    error ERC721_Error_WrongOwner();
    error Error_ERC721_Invalid_Token_ID();
    error Error_ERC721_Approval_To_Current_Owner();
    error Error_ERC721_NotApproved();
    error Error_ERC721_Token_Already_Minted();
    error Error_ERC721_Transfer_To_The_Zero_Address();
    error Error_ERC721_Transfer_To_Non_ERC721Receiver_implementer();
    error Error_ERC721_Address_Zero_Is_Not_A_Valid_Owner();
    error Error_ERC721_Mint_To_The_Zero_Address();

    mapping(uint256 => address) internal _owners;

    mapping(address => uint256) internal _balances;

    mapping(uint256 => address) internal _tokenApprovals;

    mapping(address => mapping(address => bool)) private _operatorApprovals;

    function _mint(address to, uint256 tokenId)
        internal
    {
        if( address(0) != _owners[tokenId] ) {
            revert Error_ERC721_Token_Already_Minted();
        }

        if( address(0) == to ) {
            revert Error_ERC721_Mint_To_The_Zero_Address();
        }

        _balances[to] += 1;

        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }

    function _burn(uint256 tokenId)
        internal
    {
        address owner = _owners[tokenId];
        
        if( address(0) == owner ) {
            revert Error_ERC721_Invalid_Token_ID();
        }

        delete _tokenApprovals[tokenId];

        _balances[owner] -= 1;

        delete _owners[tokenId];

        emit Transfer(owner, address(0), tokenId);
    }

    function setApprovalForAll(address operator, bool approved)
        external
    {
        if( msg.sender == operator ) {
            revert Error_ERC721_Approve_To_Caller();
        }

        _operatorApprovals[msg.sender][operator] = approved;

        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function getApproved(uint256 tokenId)
        public view 
        returns (address)
    {
        if( address(0) == _owners[tokenId] ) {
            revert Error_ERC721_Invalid_Token_ID();
        }

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
        
        if( address(0) == owner ) {
            revert Error_ERC721_Invalid_Token_ID();
        }

        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data)
        public
    {
        if( false == _isApprovedOrOwner(msg.sender, tokenId) ) {
            revert Error_ERC721_NotApproved();
        }

        _transfer(from, to, tokenId);

        if( ! _checkOnERC721Received(from, to, tokenId, data) ) {
            revert Error_ERC721_Transfer_To_Non_ERC721Receiver_implementer();
        }
    }

    function transferFrom(address from, address to, uint256 tokenId)
        external
    {
        if( false == _isApprovedOrOwner(msg.sender, tokenId) ) {
            revert Error_ERC721_NotApproved();
        }

        _transfer(from, to, tokenId);
    }

    function _transfer(address from, address to, uint256 tokenId)
        private
    {
        if( _owners[tokenId] != from ) {
            revert ERC721_Error_WrongOwner();
        }

        if( to == address(0) ) {
            revert Error_ERC721_Transfer_To_The_Zero_Address();
        }

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
        internal
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
                    revert Error_ERC721_Transfer_To_Non_ERC721Receiver_implementer();
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
        public view virtual override(ERC165, IERC165)
        returns (bool) 
    {
        return interfaceId == type(IERC721).interfaceId
             || super.supportsInterface(interfaceId);
    }

    function ownerOf(uint256 tokenId)
        external view
        returns (address)
    {
        address owner = _owners[tokenId];

        if( address(0) == owner ) {
            revert Error_ERC721_Invalid_Token_ID();
        }

        return owner;
    }

    function approve(address to, uint256 tokenId)
        external
    {
        address owner = _owners[tokenId];

        if( address(0) == owner ) {
            revert Error_ERC721_Invalid_Token_ID();
        }

        if( to == owner ) {
            revert Error_ERC721_Approval_To_Current_Owner();
        }

        if( msg.sender != owner && ! isApprovedForAll(owner, msg.sender) ) {
            revert Error_ERC721_NotApproved();
        }

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
        if( owner == address(0) ) {
            revert Error_ERC721_Address_Zero_Is_Not_A_Valid_Owner();
        }
        return _balances[owner];
    }
}
