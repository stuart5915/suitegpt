// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

/**
 * @title SuiteBoosts
 * @dev ERC-1155 NFT contract for SUITE boost tokens
 * 
 * Boost Types:
 * - Token ID 1: Priority Queue (skip command queue for 7 days)
 * - Token ID 2: AI Pack (+50 AI commands)
 * - Token ID 3: App Slot (+1 permanent app slot)
 * - Token ID 4: Featured Week (7 days homepage feature)
 * - Token ID 5: 2x Earn (double earnings for 7 days)
 * 
 * Only the admin (backend) can mint boosts when users convert from database.
 * Users can freely transfer and burn (redeem) their boost NFTs.
 */
contract SuiteBoosts is ERC1155, Ownable, ERC1155Burnable, ERC1155Supply {
    // Boost Type Constants
    uint256 public constant PRIORITY_QUEUE = 1;
    uint256 public constant AI_PACK = 2;
    uint256 public constant APP_SLOT = 3;
    uint256 public constant FEATURED_WEEK = 4;
    uint256 public constant DOUBLE_EARN = 5;

    // Mapping from token ID to name
    mapping(uint256 => string) public boostNames;
    
    // Track total minted per type (for analytics)
    mapping(uint256 => uint256) public totalMinted;
    
    // Events
    event BoostMinted(address indexed to, uint256 indexed boostType, uint256 amount);
    event BoostRedeemed(address indexed from, uint256 indexed boostType, uint256 amount);

    constructor() ERC1155("https://suite.gives/api/boost-metadata/{id}.json") Ownable(msg.sender) {
        // Initialize boost names
        boostNames[PRIORITY_QUEUE] = "Priority Queue";
        boostNames[AI_PACK] = "AI Pack";
        boostNames[APP_SLOT] = "App Slot";
        boostNames[FEATURED_WEEK] = "Featured Week";
        boostNames[DOUBLE_EARN] = "2x Earn";
    }

    /**
     * @dev Mint boost NFT to a user (only owner/backend can call)
     * @param to Address to receive the boost
     * @param boostType Token ID of the boost type (1-5)
     * @param amount Number of boosts to mint
     */
    function mint(address to, uint256 boostType, uint256 amount) public onlyOwner {
        require(boostType >= 1 && boostType <= 5, "Invalid boost type");
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        
        _mint(to, boostType, amount, "");
        totalMinted[boostType] += amount;
        
        emit BoostMinted(to, boostType, amount);
    }

    /**
     * @dev Batch mint multiple boost types to a user
     * @param to Address to receive the boosts
     * @param boostTypes Array of token IDs
     * @param amounts Array of amounts for each type
     */
    function mintBatch(address to, uint256[] memory boostTypes, uint256[] memory amounts) public onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(boostTypes.length == amounts.length, "Arrays length mismatch");
        
        for (uint i = 0; i < boostTypes.length; i++) {
            require(boostTypes[i] >= 1 && boostTypes[i] <= 5, "Invalid boost type");
            totalMinted[boostTypes[i]] += amounts[i];
        }
        
        _mintBatch(to, boostTypes, amounts, "");
    }

    /**
     * @dev Redeem (burn) a boost NFT - user can call this to convert back to database boost
     * @param boostType Token ID of the boost to redeem
     * @param amount Number of boosts to redeem
     */
    function redeem(uint256 boostType, uint256 amount) public {
        require(balanceOf(msg.sender, boostType) >= amount, "Insufficient boost balance");
        
        _burn(msg.sender, boostType, amount);
        
        emit BoostRedeemed(msg.sender, boostType, amount);
    }

    /**
     * @dev Update the metadata URI
     * @param newuri New base URI for metadata
     */
    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }

    /**
     * @dev Get all boost balances for an address
     * @param account Address to check
     * @return Array of balances for boost types 1-5
     */
    function getAllBoostBalances(address account) public view returns (uint256[5] memory) {
        uint256[5] memory balances;
        for (uint i = 0; i < 5; i++) {
            balances[i] = balanceOf(account, i + 1);
        }
        return balances;
    }

    /**
     * @dev Check if an address owns any boosts
     * @param account Address to check
     * @return True if the address owns at least one boost
     */
    function hasAnyBoost(address account) public view returns (bool) {
        for (uint i = 1; i <= 5; i++) {
            if (balanceOf(account, i) > 0) {
                return true;
            }
        }
        return false;
    }

    // Required overrides for ERC1155Supply
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._update(from, to, ids, values);
    }
}
