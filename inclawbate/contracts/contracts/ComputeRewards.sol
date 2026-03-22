// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title ComputeRewards — CLAWS rewards for Inclawbator compute node operators
/// @notice Node operators earn CLAWS by contributing GPU compute to the ecosystem.
///         Server tracks compute units off-chain, signs claim authorizations.
///         Node operators submit claim tx and pay their own gas. Fully non-custodial.
/// @dev Same ECDSA pattern as PokerAIRewards. Server signs (operator, amount, nonce, contract).
contract ComputeRewards is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IERC20 public immutable clawsToken;
    address public admin;
    address public signer;              // server wallet that signs claim authorizations

    uint256 public totalDeposited;      // total CLAWS loaded into reward pool
    uint256 public totalDistributed;    // total CLAWS sent to node operators

    mapping(address => uint256) public totalClaimed;   // per-operator lifetime claims
    mapping(address => uint256) public claimNonce;     // per-operator nonce (prevents replay)
    mapping(address => bool) public registeredNode;    // registered node operators

    uint256 public totalNodes;          // count of registered nodes

    bool public paused;

    event RewardsDeposited(address indexed from, uint256 amount);
    event RewardsClaimed(address indexed operator, uint256 amount, uint256 nonce);
    event NodeRegistered(address indexed operator);
    event NodeUnregistered(address indexed operator);
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

    constructor(address _clawsToken, address _signer) {
        require(_clawsToken != address(0), "Invalid token");
        require(_signer != address(0), "Invalid signer");
        clawsToken = IERC20(_clawsToken);
        admin = msg.sender;
        signer = _signer;
    }

    // =========== Admin Functions ===========

    /// @notice Deposit CLAWS tokens into the compute reward pool
    function depositRewards(uint256 amount) external onlyAdmin nonReentrant {
        require(amount > 0, "Zero amount");
        clawsToken.safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        emit RewardsDeposited(msg.sender, amount);
    }

    /// @notice Emergency withdraw undistributed tokens
    function adminWithdraw(uint256 amount) external onlyAdmin nonReentrant {
        require(amount > 0, "Zero amount");
        require(clawsToken.balanceOf(address(this)) >= amount, "Insufficient balance");
        clawsToken.safeTransfer(admin, amount);
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

    // =========== Node Registration ===========

    /// @notice Register as a compute node operator (anyone can register)
    function registerNode() external {
        require(!registeredNode[msg.sender], "Already registered");
        registeredNode[msg.sender] = true;
        totalNodes++;
        emit NodeRegistered(msg.sender);
    }

    /// @notice Unregister as a node operator
    function unregisterNode() external {
        require(registeredNode[msg.sender], "Not registered");
        registeredNode[msg.sender] = false;
        totalNodes--;
        emit NodeUnregistered(msg.sender);
    }

    // =========== Operator Claim ===========

    /// @notice Claim CLAWS rewards — operator pays gas, server signs authorization
    /// @param amount Token amount (in wei) authorized by server based on compute contributed
    /// @param nonce Must match current claimNonce[msg.sender] (prevents replay)
    /// @param signature Server signature of keccak256(operator, amount, nonce, contractAddress)
    function claim(uint256 amount, uint256 nonce, bytes calldata signature) external nonReentrant whenNotPaused {
        require(amount > 0, "Zero amount");
        require(registeredNode[msg.sender], "Not a registered node");
        require(nonce == claimNonce[msg.sender], "Invalid nonce");
        require(clawsToken.balanceOf(address(this)) >= amount, "Insufficient reward pool");

        // Verify server signature
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, amount, nonce, address(this)));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);
        require(recovered == signer, "Invalid signature");

        claimNonce[msg.sender] = nonce + 1;
        totalClaimed[msg.sender] += amount;
        totalDistributed += amount;

        clawsToken.safeTransfer(msg.sender, amount);

        emit RewardsClaimed(msg.sender, amount, nonce);
    }

    // =========== View Functions ===========

    function poolRemaining() external view returns (uint256) {
        return clawsToken.balanceOf(address(this));
    }

    function nodeInfo(address operator) external view returns (
        bool registered,
        uint256 claimed,
        uint256 nonce
    ) {
        return (registeredNode[operator], totalClaimed[operator], claimNonce[operator]);
    }

    function rewardStats() external view returns (
        uint256 deposited,
        uint256 distributed,
        uint256 remaining,
        uint256 nodes
    ) {
        return (totalDeposited, totalDistributed, clawsToken.balanceOf(address(this)), totalNodes);
    }
}
