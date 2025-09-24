// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Mock ERC1155 สำหรับการทดสอบ:
 * - มี mint / mintBatch แบบ external onlyOwner
 * - baseURI มาตรฐาน ipfs://test/{id}.json
 */
contract MockCards1155 is ERC1155, Ownable {
    constructor() ERC1155("ipfs://test/{id}.json") Ownable(msg.sender) {}

    function mint(address to, uint256 id, uint256 amount) external onlyOwner {
        _mint(to, id, amount, "");
    }

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external onlyOwner {
        _mintBatch(to, ids, amounts, "");
    }
}
