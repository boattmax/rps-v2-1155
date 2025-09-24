// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title RPSCards1155 Ver2.0 - 6 IDs: 1..3 (Normal R/P/S), 4..6 (Rare R/P/S)
contract RPSCards1155 is ERC1155, ERC1155Supply, Ownable {
    using Strings for uint256;

    string public name = "RPS Cards V2";
    string public symbol = "RPS2";
    string private _base;

    /// @param baseURI เช่น "ipfs://CID_META/" (อย่าลืมปิดท้ายด้วย "/")
    constructor(string memory baseURI, address initialOwner) ERC1155("") Ownable(initialOwner) {
        _base = baseURI;
    }

    function setBaseURI(string calldata u) external onlyOwner {
        _base = u;
        emit URI(u, 0);
    }

    function uri(uint256 id) public view override returns (string memory) {
        return string(abi.encodePacked(_base, id.toString(), ".json"));
    }

    function isRare(uint256 id) public pure returns (bool) {
        return id >= 4 && id <= 6;
    }

    function baseKind(uint256 id) public pure returns (uint256) {
        return ((id - 1) % 3) + 1;
    }

    function devMint(address to, uint256 id, uint256 amount) external onlyOwner {
        _mint(to, id, amount, "");
    }

    function devMintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external onlyOwner {
        _mintBatch(to, ids, amounts, "");
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._update(from, to, ids, values);
    }
}
