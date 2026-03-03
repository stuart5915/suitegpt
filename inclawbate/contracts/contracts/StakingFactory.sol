// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title StakingFactory — EIP-1167 Clone Factory for Inclawbator
/// @notice Deploys minimal proxy staking pools from ClawnchRewardsLite.
///         Two modes:
///         - deployFree: admin deploys for incubated projects (no cost)
///         - deployPaid: anyone can deploy by paying INCLAWNCH to feeRecipient
contract StakingFactory {
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //  STATE
    // ══════════════════════════════════════════════════════════════

    address public owner;
    address public implementation;     // ClawnchRewardsLite address
    IERC20  public burnToken;          // INCLAWNCH
    uint256 public deployFee;          // amount paid for deployPaid
    address public feeRecipient;       // receives deploy fees (inclawbate.base.eth)

    address[] public allPools;
    mapping(address => address) public poolAdmin;     // pool -> admin
    mapping(address => address) public poolToken;     // pool -> staking token

    // ══════════════════════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════════════════════

    event PoolDeployed(
        address indexed pool,
        address indexed stakingToken,
        address indexed admin,
        bool paid
    );
    event ImplementationUpdated(address oldImpl, address newImpl);
    event DeployFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event OwnerTransferred(address oldOwner, address newOwner);

    // ══════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ══════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // ══════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════

    /// @param _implementation ClawnchRewardsLite deployed address
    /// @param _burnToken      INCLAWNCH token address
    /// @param _deployFee      Amount of INCLAWNCH paid per deployPaid
    /// @param _feeRecipient   Address that receives deploy fees
    constructor(address _implementation, address _burnToken, uint256 _deployFee, address _feeRecipient) {
        require(_implementation != address(0), "zero impl");
        require(_burnToken != address(0), "zero burn token");
        require(_feeRecipient != address(0), "zero fee recipient");

        owner = msg.sender;
        implementation = _implementation;
        burnToken = IERC20(_burnToken);
        deployFee = _deployFee;
        feeRecipient = _feeRecipient;
    }

    // ══════════════════════════════════════════════════════════════
    //  DEPLOY FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    /// @notice Admin deploys a free staking pool for incubated projects.
    /// @param stakingToken Token that users stake
    /// @param rewardToken  Token distributed as rewards (usually INCLAWNCH)
    /// @param poolAdminAddr  Admin of the new pool
    function deployFree(
        address stakingToken,
        address rewardToken,
        address poolAdminAddr
    ) external onlyOwner returns (address pool) {
        pool = _deploy(stakingToken, rewardToken, poolAdminAddr, false);
    }

    /// @notice Anyone can deploy a staking pool. Free if deployFee is 0.
    /// @param stakingToken Token that users stake
    /// @param rewardToken  Token distributed as rewards (usually INCLAWNCH)
    function deployPaid(
        address stakingToken,
        address rewardToken
    ) external returns (address pool) {
        // Collect fee only if set (0 = free deploy)
        if (deployFee > 0) {
            require(feeRecipient != address(0), "no fee recipient");
            burnToken.safeTransferFrom(msg.sender, feeRecipient, deployFee);
        }

        pool = _deploy(stakingToken, rewardToken, msg.sender, true);
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL
    // ══════════════════════════════════════════════════════════════

    function _deploy(
        address stakingToken,
        address rewardToken,
        address adminAddr,
        bool paid
    ) internal returns (address pool) {
        require(stakingToken != address(0), "zero staking token");
        require(rewardToken != address(0), "zero reward token");
        require(adminAddr != address(0), "zero admin");

        // Deploy EIP-1167 minimal proxy
        pool = Clones.clone(implementation);

        // Initialize the clone
        // ClawnchRewardsLite.initialize(stakingToken, rewardToken, admin)
        (bool ok, ) = pool.call(
            abi.encodeWithSignature(
                "initialize(address,address,address)",
                stakingToken,
                rewardToken,
                adminAddr
            )
        );
        require(ok, "init failed");

        // Registry
        allPools.push(pool);
        poolAdmin[pool] = adminAddr;
        poolToken[pool] = stakingToken;

        emit PoolDeployed(pool, stakingToken, adminAddr, paid);
    }

    // ══════════════════════════════════════════════════════════════
    //  VIEW
    // ══════════════════════════════════════════════════════════════

    function poolCount() external view returns (uint256) {
        return allPools.length;
    }

    function getAllPools() external view returns (address[] memory) {
        return allPools;
    }

    // ══════════════════════════════════════════════════════════════
    //  ADMIN
    // ══════════════════════════════════════════════════════════════

    function setImplementation(address _impl) external onlyOwner {
        require(_impl != address(0), "zero impl");
        emit ImplementationUpdated(implementation, _impl);
        implementation = _impl;
    }

    function setDeployFee(uint256 _fee) external onlyOwner {
        emit DeployFeeUpdated(deployFee, _fee);
        deployFee = _fee;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "zero address");
        emit FeeRecipientUpdated(feeRecipient, _recipient);
        feeRecipient = _recipient;
    }

    function transferOwner(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "zero address");
        emit OwnerTransferred(owner, _newOwner);
        owner = _newOwner;
    }
}
