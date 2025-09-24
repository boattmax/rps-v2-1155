// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

/// @title RPSGame1155 - จัดแมตช์ 1v1 ด้วย ERC1155 หน่วยละ 1
/// @notice ห้ามแรร์สู้กับธรรมดา และห้ามจับคู่กับตัวเอง
contract RPSGame1155 is ERC1155Holder {
    IERC1155 public immutable token;

    struct Match {
        address p1;
        uint256 t1;
        address p2;
        uint256 t2;
        bool    resolved;
        address winner;
    }

    uint256 public nextMatchId;
    mapping(uint256 => Match) public matches;

    event MatchCreated(uint256 indexed id, address indexed p1, uint256 t1, bool isRareGroup);
    event MatchJoined(uint256 indexed id, address indexed p2, uint256 t2);
    event MatchResolved(uint256 indexed id, address winner, uint8 outcome);
    event MatchCanceled(uint256 indexed id);

    constructor(IERC1155 _token) {
        token = _token;
    }

    function _isRare(uint256 id) internal pure returns (bool) {
        return id >= 4 && id <= 6;
    }
    function _baseKind(uint256 id) internal pure returns (uint256) {
        return ((id - 1) % 3) + 1; // 1=R,2=P,3=S
    }
    function _beats(uint256 a, uint256 b) internal pure returns (bool) {
        if (a == 1 && b == 3) return true; // R>S
        if (a == 2 && b == 1) return true; // P>R
        if (a == 3 && b == 2) return true; // S>P
        return false;
    }

    function createMatch(uint256 tokenId) external returns (uint256 id) {
        token.safeTransferFrom(msg.sender, address(this), tokenId, 1, "");
        id = nextMatchId++;
        matches[id] = Match({
            p1: msg.sender,
            t1: tokenId,
            p2: address(0),
            t2: 0,
            resolved: false,
            winner: address(0)
        });
        emit MatchCreated(id, msg.sender, tokenId, _isRare(tokenId));
    }

    function joinMatch(uint256 id, uint256 tokenId) external {
        Match storage m = matches[id];
        require(m.p1 != address(0), "not-exist");
        require(!m.resolved && m.p2 == address(0), "already-joined");
        require(m.p1 != msg.sender, "self-join"); // 🚫 block self-match
        require(_isRare(m.t1) == _isRare(tokenId), "rarity-mismatch");

        token.safeTransferFrom(msg.sender, address(this), tokenId, 1, "");

        m.p2 = msg.sender;
        m.t2 = tokenId;
        emit MatchJoined(id, msg.sender, tokenId);

        uint256 a = _baseKind(m.t1);
        uint256 b = _baseKind(m.t2);
        uint8 outcome = 0; // 0=tie,1=p1win,2=p2win

        if (a == b) {
            token.safeTransferFrom(address(this), m.p1, m.t1, 1, "");
            token.safeTransferFrom(address(this), m.p2, m.t2, 1, "");
            m.winner = address(0);
            outcome = 0;
        } else if (_beats(a, b)) {
            token.safeTransferFrom(address(this), m.p1, m.t1, 1, "");
            token.safeTransferFrom(address(this), m.p1, m.t2, 1, "");
            m.winner = m.p1;
            outcome = 1;
        } else {
            token.safeTransferFrom(address(this), m.p2, m.t2, 1, "");
            token.safeTransferFrom(address(this), m.p2, m.t1, 1, "");
            m.winner = m.p2;
            outcome = 2;
        }

        m.resolved = true;
        emit MatchResolved(id, m.winner, outcome);
    }

    function cancelMatch(uint256 id) external {
        Match storage m = matches[id];
        require(m.p1 == msg.sender, "only-p1");
        require(m.p2 == address(0) && !m.resolved, "cannot-cancel");

        token.safeTransferFrom(address(this), m.p1, m.t1, 1, "");
        delete matches[id];
        emit MatchCanceled(id);
    }
}
