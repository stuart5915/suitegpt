// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title StakingFactoryV3 — EIP-1167 Clone Factory with Multi-Depositor
/// @notice Deploys ClawnchRewardsV3 clones with auto-registered reward depositors.
///         Every pool automatically grants inclawbate.base.eth as a depositor
///         so the automated CLAWS reward pipeline can deposit without admin keys.
contract StakingFactoryV3 {
    using SafeERC20 for IERC20;

    address public owner;
    address public implementation;     // ClawnchRewardsV3 address
    IERC20  public burnToken;          // INCLAWNCH
    uint256 public deployFee;          // amount paid for deployPaid (0 = free)
    address public feeRecipient;       // receives deploy fees
    address public platformDepositor;  // auto-granted as depositor on every pool (inclawbate.base.eth)

    address[] public allPools;
    mapping(address => address) public poolAdmin;
    mapping(address => address) public poolToken;

    event PoolDeployed(address indexed pool, address indexed stakingToken, address indexed admin, bool paid);
    event ImplementationUpdated(address oldImpl, address newImpl);
    event DeployFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event PlatformDepositorUpdated(address oldDepositor, address newDepositor);
    event OwnerTransferred(address oldOwner, address newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /// @param _implementation ClawnchRewardsV3 deployed address
    /// @param _burnToken      INCLAWNCH token address
    /// @param _deployFee      Amount of INCLAWNCH paid per deployPaid (0 = free)
    /// @param _feeRecipient   Address that receives deploy fees
    /// @param _platformDepositor  Address auto-granted as depositor on every pool (inclawbate.base.eth)
    constructor(
        address _implementation,
        address _burnToken,
        uint256 _deployFee,
        address _feeRecipient,
        address _platformDepositor
    ) {
        require(_implementation != address(0), "zero impl");
        require(_burnToken != address(0), "zero burn token");
        require(_feeRecipient != address(0), "zero fee recipient");
        require(_platformDepositor != address(0), "zero platform depositor");

        owner = msg.sender;
        implementation = _implementation;
        burnToken = IERC20(_burnToken);
        deployFee = _deployFee;
        feeRecipient = _feeRecipient;
        platformDepositor = _platformDepositor;
    }

    /// @notice Admin deploys a free staking pool for incubated projects.
    function deployFree(
        address stakingToken,
        address rewardToken,
        address poolAdminAddr
    ) external onlyOwner returns (address pool) {
        pool = _deploy(stakingToken, rewardToken, poolAdminAddr, false);
    }

    /// @notice Anyone can deploy a staking pool. Free if deployFee is 0.
    function deployPaid(
        address stakingToken,
        address rewardToken
    ) external returns (address pool) {
        if (deployFee > 0) {
            require(feeRecipient != address(0), "no fee recipient");
            burnToken.safeTransferFrom(msg.sender, feeRecipient, deployFee);
        }
        pool = _deploy(stakingToken, rewardToken, msg.sender, true);
    }

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

        // Initialize the clone with platform depositor auto-granted
        (bool ok, ) = pool.call(
            abi.encodeWithSignature(
                "initializeWithDepositor(address,address,address,address)",
                stakingToken,
                rewardToken,
                adminAddr,
                platformDepositor
            )
        );
        require(ok, "init failed");

        // Registry
        allPools.push(pool);
        poolAdmin[pool] = adminAddr;
        poolToken[pool] = stakingToken;

        emit PoolDeployed(pool, stakingToken, adminAddr, paid);
    }

    function poolCount() external view returns (uint256) {
        return allPools.length;
    }

    function getAllPools() external view returns (address[] memory) {
        return allPools;
    }

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

    function setPlatformDepositor(address _depositor) external onlyOwner {
        require(_depositor != address(0), "zero address");
        emit PlatformDepositorUpdated(platformDepositor, _depositor);
        platformDepositor = _depositor;
    }

    function transferOwner(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "zero address");
        emit OwnerTransferred(owner, _newOwner);
        owner = _newOwner;
    }
}
