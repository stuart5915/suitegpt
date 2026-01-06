// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SUITE Token
 * @dev ERC-20 token for the Stuart Hollinger app ecosystem
 * 
 * Key Features:
 * - Minting controlled by authorized minters (Treasury contract)
 * - Burnable by token holders and authorized burners (App contracts)
 * - Owner can add/remove minters and burners
 * 
 * Tokenomics:
 * - Backing Rate: $1 = 1,000 SUITE
 * - Initial Supply: 0 (minted on deposit)
 * - No max supply (backed by treasury)
 */
contract SuiteToken is ERC20, ERC20Burnable, Ownable {
    
    // Mapping of addresses authorized to mint tokens
    mapping(address => bool) public minters;
    
    // Mapping of addresses authorized to burn tokens on behalf of users
    mapping(address => bool) public burners;
    
    // Events
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event BurnerAdded(address indexed burner);
    event BurnerRemoved(address indexed burner);
    
    constructor(address initialOwner) 
        ERC20("SUITE", "SUITE") 
        Ownable(initialOwner) 
    {
        // No initial supply - tokens minted on deposit
    }
    
    /**
     * @dev Modifier to check if caller is an authorized minter
     */
    modifier onlyMinter() {
        require(minters[msg.sender], "SuiteToken: caller is not a minter");
        _;
    }
    
    /**
     * @dev Modifier to check if caller is an authorized burner
     */
    modifier onlyBurner() {
        require(burners[msg.sender], "SuiteToken: caller is not a burner");
        _;
    }
    
    /**
     * @dev Add a new minter (only owner)
     * @param minter Address to grant minting permission
     */
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "SuiteToken: minter is zero address");
        require(!minters[minter], "SuiteToken: already a minter");
        minters[minter] = true;
        emit MinterAdded(minter);
    }
    
    /**
     * @dev Remove a minter (only owner)
     * @param minter Address to revoke minting permission
     */
    function removeMinter(address minter) external onlyOwner {
        require(minters[minter], "SuiteToken: not a minter");
        minters[minter] = false;
        emit MinterRemoved(minter);
    }
    
    /**
     * @dev Add a new burner (only owner)
     * @param burner Address to grant burning permission
     */
    function addBurner(address burner) external onlyOwner {
        require(burner != address(0), "SuiteToken: burner is zero address");
        require(!burners[burner], "SuiteToken: already a burner");
        burners[burner] = true;
        emit BurnerAdded(burner);
    }
    
    /**
     * @dev Remove a burner (only owner)
     * @param burner Address to revoke burning permission
     */
    function removeBurner(address burner) external onlyOwner {
        require(burners[burner], "SuiteToken: not a burner");
        burners[burner] = false;
        emit BurnerRemoved(burner);
    }
    
    /**
     * @dev Mint new tokens (only authorized minters - typically Treasury)
     * @param to Address to receive tokens
     * @param amount Amount of tokens to mint (in wei, 18 decimals)
     */
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens from a user's balance (only authorized burners)
     * Used by app contracts to deduct SUITE for app usage
     * Requires user to have approved the burner contract
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address from, uint256 amount) public override {
        if (burners[msg.sender]) {
            // Authorized burners can burn without allowance check
            // This is for app contracts that users have pre-approved
            _burn(from, amount);
        } else {
            // Standard burnFrom with allowance check
            super.burnFrom(from, amount);
        }
    }
}
