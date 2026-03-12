// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PokerAIRewards — distributes POKERAI tokens to poker players
/// @notice Admin deposits POKERAI tokens. Operator (server) distributes to players when they claim.
/// @dev Same trust model as PokerChipVault — server tracks earnings off-chain, distributes on-chain.
contract PokerAIRewards is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable pokeraiToken;
    address public admin;
    address public operator;

    uint256 public totalDeposited;      // total POKERAI loaded into contract
    uint256 public totalDistributed;    // total POKERAI sent to players

    mapping(address => uint256) public totalClaimed;   // per-wallet lifetime claims
    mapping(address => uint256) public claimNonce;     // per-wallet nonce (prevents double-send)

    bool public paused;

    event RewardsDeposited(address indexed from, uint256 amount);
    event RewardsClaimed(address indexed player, uint256 amount, uint256 nonce);
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event Paused(bool isPaused);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Not operator");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }

    constructor(address _pokeraiToken, address _operator) {
        require(_pokeraiToken != address(0), "Invalid token");
        require(_operator != address(0), "Invalid operator");
        pokeraiToken = IERC20(_pokeraiToken);
        admin = msg.sender;
        operator = _operator;
    }

    // =========== Admin Functions ===========

    /// @notice Deposit POKERAI tokens into the reward pool (can be called multiple times)
    function depositRewards(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        pokeraiToken.safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        emit RewardsDeposited(msg.sender, amount);
    }

    /// @notice Emergency withdraw undistributed tokens
    function adminWithdraw(uint256 amount) external onlyAdmin nonReentrant {
        require(amount > 0, "Zero amount");
        require(pokeraiToken.balanceOf(address(this)) >= amount, "Insufficient balance");
        pokeraiToken.safeTransfer(admin, amount);
    }

    function setOperator(address _operator) external onlyAdmin {
        require(_operator != address(0), "Invalid operator");
        emit OperatorUpdated(operator, _operator);
        operator = _operator;
    }

    function setPaused(bool _paused) external onlyAdmin {
        paused = _paused;
        emit Paused(_paused);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // =========== Operator Functions ===========

    /// @notice Distribute POKERAI to a player — called by server when player claims
    function distribute(address player, uint256 amount) external onlyOperator nonReentrant whenNotPaused {
        require(player != address(0), "Invalid player");
        require(amount > 0, "Zero amount");
        require(pokeraiToken.balanceOf(address(this)) >= amount, "Insufficient reward pool");

        uint256 nonce = claimNonce[player];
        claimNonce[player] = nonce + 1;
        totalClaimed[player] += amount;
        totalDistributed += amount;

        pokeraiToken.safeTransfer(player, amount);

        emit RewardsClaimed(player, amount, nonce);
    }

    // =========== View Functions ===========

    function poolRemaining() external view returns (uint256) {
        return pokeraiToken.balanceOf(address(this));
    }

    function playerInfo(address player) external view returns (
        uint256 claimed,
        uint256 nonce
    ) {
        return (totalClaimed[player], claimNonce[player]);
    }

    function rewardStats() external view returns (
        uint256 deposited,
        uint256 distributed,
        uint256 remaining
    ) {
        return (totalDeposited, totalDistributed, pokeraiToken.balanceOf(address(this)));
    }
}
