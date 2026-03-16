// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title PokerAIRewards — user-claimable POKERAI reward distribution
/// @notice Server signs authorization messages off-chain. Users submit claim tx and pay their own gas.
/// @dev Uses ECDSA signature verification. Server (signer) authorizes (player, amount, nonce).
contract PokerAIRewards is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IERC20 public immutable pokeraiToken;
    address public admin;
    address public signer;              // server wallet that signs claim authorizations

    uint256 public totalDeposited;      // total POKERAI loaded into contract
    uint256 public totalDistributed;    // total POKERAI sent to players

    mapping(address => uint256) public totalClaimed;   // per-wallet lifetime claims
    mapping(address => uint256) public claimNonce;     // per-wallet nonce (prevents replay)

    bool public paused;

    event RewardsDeposited(address indexed from, uint256 amount);
    event RewardsClaimed(address indexed player, uint256 amount, uint256 nonce);
    event AdminWithdraw(address indexed to, uint256 amount);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event Paused(bool isPaused);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }

    constructor(address _pokeraiToken, address _signer) {
        require(_pokeraiToken != address(0), "Invalid token");
        require(_signer != address(0), "Invalid signer");
        pokeraiToken = IERC20(_pokeraiToken);
        admin = msg.sender;
        signer = _signer;
    }

    // =========== Admin Functions ===========

    /// @notice Deposit POKERAI tokens into the reward pool
    function depositRewards(uint256 amount) external onlyAdmin nonReentrant {
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
        emit AdminWithdraw(admin, amount);
    }

    function setSigner(address _signer) external onlyAdmin {
        require(_signer != address(0), "Invalid signer");
        emit SignerUpdated(signer, _signer);
        signer = _signer;
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

    // =========== User Claim ===========

    /// @notice Claim POKERAI rewards — user pays gas, server signs authorization
    /// @param amount Token amount (in wei) authorized by server
    /// @param nonce Must match current claimNonce[msg.sender] (prevents replay)
    /// @param signature Server signature of keccak256(player, amount, nonce, contractAddress)
    function claim(uint256 amount, uint256 nonce, bytes calldata signature) external nonReentrant whenNotPaused {
        require(amount > 0, "Zero amount");
        require(nonce == claimNonce[msg.sender], "Invalid nonce");
        require(pokeraiToken.balanceOf(address(this)) >= amount, "Insufficient reward pool");

        // Verify server signature
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, amount, nonce, address(this)));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);
        require(recovered == signer, "Invalid signature");

        claimNonce[msg.sender] = nonce + 1;
        totalClaimed[msg.sender] += amount;
        totalDistributed += amount;

        pokeraiToken.safeTransfer(msg.sender, amount);

        emit RewardsClaimed(msg.sender, amount, nonce);
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
