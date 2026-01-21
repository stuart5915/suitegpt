// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../interfaces/IYearnVault.sol";

/**
 * @title SuiteVaultV2
 * @notice Non-custodial yield vault that deposits directly to Yearn
 * @dev Users deposit USDC, receive SUITE shares, earn Yearn yield automatically
 *
 * Architecture:
 * - Layer 1: USDC (base asset)
 * - Layer 2: SUITE (vault shares, yield-earning, withdrawable)
 * - Layer 3: Credits (app utility, one-way from SUITE, NOT withdrawable)
 *
 * Non-custodial guarantees:
 * - NO admin can withdraw user funds to personal wallet
 * - NO deployToYield() - contract auto-deposits to Yearn
 * - Users can ALWAYS withdraw (subject to Yearn liquidity)
 * - Admin powers limited to: vault migration, pause, credit settings
 *
 * Security features:
 * - ReentrancyGuard on all state-changing functions
 * - Pausable for emergency stops (deposits only, withdrawals always work)
 * - Owner-only admin functions
 */

interface ISuiteShareToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

interface ISuiteCredits {
    function mint(address to, uint256 amount) external;
}

contract SuiteVaultV2 is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ STATE VARIABLES ============

    /// @notice The underlying asset (USDC)
    IERC20 public immutable baseAsset;

    /// @notice SUITE share token
    ISuiteShareToken public immutable suiteToken;

    /// @notice Credits token
    ISuiteCredits public creditsToken;

    /// @notice Current Yearn vault for yield generation
    IYearnVault public yearnVault;

    /// @notice Bonus multiplier for credits (in basis points, 10000 = 1x, 12000 = 1.2x)
    uint256 public creditsBonusBps = 10000;

    /// @notice Minimum deposit amount (prevent dust attacks)
    uint256 public minDeposit = 1e6; // $1 USDC

    /// @notice Deposit fee in basis points (default 0)
    uint256 public depositFeeBps = 0;

    /// @notice Withdrawal fee in basis points (default 0)
    uint256 public withdrawFeeBps = 0;

    /// @notice Maximum fee (5%)
    uint256 public constant MAX_FEE_BPS = 500;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Accumulated protocol fees
    uint256 public accumulatedFees;

    /// @notice Treasury address for fee collection
    address public treasury;

    // ============ EVENTS ============

    event Deposited(
        address indexed user,
        uint256 assetAmount,
        uint256 suiteAmount,
        uint256 yearnSharesReceived
    );

    event Withdrawn(
        address indexed user,
        uint256 suiteAmount,
        uint256 assetAmount,
        uint256 yearnSharesBurned
    );

    event ConvertedToCredits(
        address indexed user,
        uint256 suiteAmount,
        uint256 creditsAmount
    );

    event YearnVaultMigrated(
        address indexed oldVault,
        address indexed newVault,
        uint256 totalAssets
    );

    event CreditsBonusUpdated(uint256 oldBps, uint256 newBps);
    event FeesUpdated(uint256 depositFeeBps, uint256 withdrawFeeBps);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event CreditsTokenSet(address indexed creditsToken);

    // ============ ERRORS ============

    error ZeroAddress();
    error ZeroAmount();
    error AmountTooSmall();
    error InsufficientBalance();
    error InsufficientYearnLiquidity();
    error FeeTooHigh();
    error InvalidYearnVault();
    error CreditsTokenNotSet();
    error SameVault();

    // ============ CONSTRUCTOR ============

    /**
     * @notice Creates the SUITE Vault
     * @param _baseAsset Address of the base asset (USDC)
     * @param _suiteToken Address of the SUITE share token
     * @param _yearnVault Address of the Yearn vault
     * @param _owner Address of the contract owner
     * @param _treasury Address for fee collection
     */
    constructor(
        address _baseAsset,
        address _suiteToken,
        address _yearnVault,
        address _owner,
        address _treasury
    ) Ownable(_owner) {
        if (_baseAsset == address(0)) revert ZeroAddress();
        if (_suiteToken == address(0)) revert ZeroAddress();
        if (_yearnVault == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();

        baseAsset = IERC20(_baseAsset);
        suiteToken = ISuiteShareToken(_suiteToken);
        yearnVault = IYearnVault(_yearnVault);
        treasury = _treasury;

        // Verify Yearn vault uses the same base asset
        if (yearnVault.asset() != _baseAsset) revert InvalidYearnVault();

        // Approve Yearn vault to spend base asset (max approval for gas efficiency)
        baseAsset.approve(_yearnVault, type(uint256).max);
    }

    // ============ USER FUNCTIONS ============

    /**
     * @notice Deposit USDC and receive SUITE shares
     * @dev Auto-deposits to Yearn vault, mints proportional SUITE
     * @param amount Amount of USDC to deposit
     * @return suiteAmount Amount of SUITE tokens minted
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused returns (uint256 suiteAmount) {
        if (amount == 0) revert ZeroAmount();
        if (amount < minDeposit) revert AmountTooSmall();

        // Transfer USDC from user
        baseAsset.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate and deduct fee
        uint256 fee = (amount * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = amount - fee;
        if (fee > 0) {
            accumulatedFees += fee;
        }

        // Deposit to Yearn vault and get shares
        uint256 yearnSharesBefore = yearnVault.balanceOf(address(this));
        yearnVault.deposit(netAmount, address(this));
        uint256 yearnSharesReceived = yearnVault.balanceOf(address(this)) - yearnSharesBefore;

        // Calculate SUITE to mint based on share of Yearn position
        suiteAmount = _calculateMintAmount(yearnSharesReceived);

        // Mint SUITE to user
        suiteToken.mint(msg.sender, suiteAmount);

        emit Deposited(msg.sender, amount, suiteAmount, yearnSharesReceived);
    }

    /**
     * @notice Withdraw USDC by burning SUITE shares
     * @dev Redeems from Yearn vault, burns SUITE, returns USDC
     * @param suiteAmount Amount of SUITE to burn
     * @return assetAmount Amount of USDC returned
     */
    function withdraw(uint256 suiteAmount) external nonReentrant returns (uint256 assetAmount) {
        if (suiteAmount == 0) revert ZeroAmount();
        if (suiteToken.balanceOf(msg.sender) < suiteAmount) revert InsufficientBalance();

        // Calculate user's share of Yearn position
        uint256 yearnSharesToRedeem = _calculateYearnShares(suiteAmount);

        // Check Yearn liquidity
        uint256 maxRedeem = yearnVault.maxRedeem(address(this));
        if (yearnSharesToRedeem > maxRedeem) revert InsufficientYearnLiquidity();

        // Burn user's SUITE
        suiteToken.burn(msg.sender, suiteAmount);

        // Redeem from Yearn
        assetAmount = yearnVault.redeem(yearnSharesToRedeem, address(this), address(this));

        // Calculate and deduct fee
        uint256 fee = (assetAmount * withdrawFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = assetAmount - fee;
        if (fee > 0) {
            accumulatedFees += fee;
        }

        // Transfer USDC to user
        baseAsset.safeTransfer(msg.sender, netAmount);

        emit Withdrawn(msg.sender, suiteAmount, netAmount, yearnSharesToRedeem);

        return netAmount;
    }

    /**
     * @notice Buy Credits with SUITE (one-way, non-redeemable)
     * @dev SUITE is transferred to treasury, Credits minted to user
     *      Treasury can later redeem SUITE for USDC to pay API costs
     * @param suiteAmount Amount of SUITE to spend
     * @return creditsAmount Amount of credits received
     */
    function buyCredits(uint256 suiteAmount) external nonReentrant returns (uint256 creditsAmount) {
        if (address(creditsToken) == address(0)) revert CreditsTokenNotSet();
        if (suiteAmount == 0) revert ZeroAmount();
        if (suiteToken.balanceOf(msg.sender) < suiteAmount) revert InsufficientBalance();

        // Calculate credits with bonus
        // If creditsBonusBps = 12000, user gets 20% more credits
        creditsAmount = (suiteAmount * creditsBonusBps) / BPS_DENOMINATOR;

        // Transfer SUITE to treasury (instead of burning)
        // Treasury holds SUITE and can redeem for USDC to pay API costs
        IERC20(address(suiteToken)).safeTransferFrom(msg.sender, treasury, suiteAmount);

        // Mint credits to user
        creditsToken.mint(msg.sender, creditsAmount);

        emit ConvertedToCredits(msg.sender, suiteAmount, creditsAmount);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get the current share price (USDC per SUITE)
     * @return price Price in USDC (6 decimals) per SUITE (18 decimals)
     */
    function getSharePrice() public view returns (uint256 price) {
        uint256 totalSupply = suiteToken.totalSupply();
        if (totalSupply == 0) {
            // Initial price: 1 SUITE = 1 USDC (adjusted for decimals)
            return 1e6; // 1 USDC
        }

        uint256 totalAssets = getTotalAssets();
        // price = totalAssets * 1e18 / totalSupply
        // Result is in USDC decimals (6) per SUITE (18 decimals)
        return (totalAssets * 1e18) / totalSupply;
    }

    /**
     * @notice Get total assets managed by this vault (in Yearn)
     * @return Total USDC value of Yearn position
     */
    function getTotalAssets() public view returns (uint256) {
        uint256 yearnShares = yearnVault.balanceOf(address(this));
        if (yearnShares == 0) return 0;
        return yearnVault.convertToAssets(yearnShares);
    }

    /**
     * @notice Preview deposit - how much SUITE for a given USDC amount
     * @param assetAmount Amount of USDC to deposit
     * @return suiteAmount Amount of SUITE that would be minted
     */
    function previewDeposit(uint256 assetAmount) external view returns (uint256 suiteAmount) {
        uint256 fee = (assetAmount * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = assetAmount - fee;

        // Preview Yearn shares
        uint256 yearnShares = yearnVault.previewDeposit(netAmount);
        return _calculateMintAmount(yearnShares);
    }

    /**
     * @notice Preview withdrawal - how much USDC for a given SUITE amount
     * @param suiteAmount Amount of SUITE to burn
     * @return assetAmount Amount of USDC that would be returned
     */
    function previewWithdraw(uint256 suiteAmount) external view returns (uint256 assetAmount) {
        uint256 yearnShares = _calculateYearnShares(suiteAmount);
        uint256 grossAssets = yearnVault.previewRedeem(yearnShares);
        uint256 fee = (grossAssets * withdrawFeeBps) / BPS_DENOMINATOR;
        return grossAssets - fee;
    }

    /**
     * @notice Preview credits purchase
     * @param suiteAmount Amount of SUITE to spend
     * @return creditsAmount Amount of credits that would be received
     */
    function previewBuyCredits(uint256 suiteAmount) external view returns (uint256 creditsAmount) {
        return (suiteAmount * creditsBonusBps) / BPS_DENOMINATOR;
    }

    /**
     * @notice Get user's position details
     * @param user Address to query
     * @return suiteBalance User's SUITE balance
     * @return assetValue USDC value of user's position
     * @return shareOfVault User's percentage of vault (in basis points)
     */
    function getUserPosition(address user) external view returns (
        uint256 suiteBalance,
        uint256 assetValue,
        uint256 shareOfVault
    ) {
        suiteBalance = suiteToken.balanceOf(user);
        uint256 totalSupply = suiteToken.totalSupply();

        if (totalSupply == 0 || suiteBalance == 0) {
            return (suiteBalance, 0, 0);
        }

        assetValue = (getTotalAssets() * suiteBalance) / totalSupply;
        shareOfVault = (suiteBalance * BPS_DENOMINATOR) / totalSupply;
    }

    /**
     * @notice Get vault statistics
     * @return totalAssets Total USDC in Yearn
     * @return totalSupply Total SUITE supply
     * @return sharePrice Current price per SUITE
     * @return yearnShares Total Yearn shares owned
     */
    function getVaultStats() external view returns (
        uint256 totalAssets,
        uint256 totalSupply,
        uint256 sharePrice,
        uint256 yearnShares
    ) {
        return (
            getTotalAssets(),
            suiteToken.totalSupply(),
            getSharePrice(),
            yearnVault.balanceOf(address(this))
        );
    }

    // ============ INTERNAL FUNCTIONS ============

    /**
     * @notice Calculate SUITE to mint for given Yearn shares
     * @param yearnShares Amount of Yearn shares received
     * @return Amount of SUITE to mint
     */
    function _calculateMintAmount(uint256 yearnShares) internal view returns (uint256) {
        uint256 totalYearnShares = yearnVault.balanceOf(address(this));
        uint256 totalSuiteSupply = suiteToken.totalSupply();

        // If first deposit, 1:1 ratio (adjusted for yearn shares received)
        if (totalSuiteSupply == 0 || totalYearnShares == yearnShares) {
            // Convert Yearn shares to USDC equivalent, then to SUITE (18 decimals)
            uint256 assetValue = yearnVault.convertToAssets(yearnShares);
            return assetValue * 1e12; // 6 decimals (USDC) to 18 decimals (SUITE)
        }

        // Proportional minting: new_suite = yearn_shares * total_suite / (total_yearn - new_yearn)
        uint256 existingYearnShares = totalYearnShares - yearnShares;
        return (yearnShares * totalSuiteSupply) / existingYearnShares;
    }

    /**
     * @notice Calculate Yearn shares for a given SUITE amount
     * @param suiteAmount Amount of SUITE
     * @return Amount of Yearn shares
     */
    function _calculateYearnShares(uint256 suiteAmount) internal view returns (uint256) {
        uint256 totalSuiteSupply = suiteToken.totalSupply();
        if (totalSuiteSupply == 0) return 0;

        uint256 totalYearnShares = yearnVault.balanceOf(address(this));
        return (suiteAmount * totalYearnShares) / totalSuiteSupply;
    }

    // ============ ADMIN FUNCTIONS (LIMITED) ============

    /**
     * @notice Migrate to a new Yearn vault
     * @dev Withdraws all from old vault, deposits to new vault
     *      User SUITE balances unchanged - seamless migration
     * @param newYearnVault Address of the new Yearn vault
     */
    function migrateYearnVault(address newYearnVault) external onlyOwner nonReentrant {
        if (newYearnVault == address(0)) revert ZeroAddress();
        if (newYearnVault == address(yearnVault)) revert SameVault();

        IYearnVault newVault = IYearnVault(newYearnVault);

        // Verify new vault uses same base asset
        if (newVault.asset() != address(baseAsset)) revert InvalidYearnVault();

        address oldVaultAddr = address(yearnVault);

        // Redeem all from old vault
        uint256 yearnShares = yearnVault.balanceOf(address(this));
        uint256 totalAssets = 0;
        if (yearnShares > 0) {
            totalAssets = yearnVault.redeem(yearnShares, address(this), address(this));
        }

        // Approve and deposit to new vault
        baseAsset.approve(newYearnVault, type(uint256).max);
        if (totalAssets > 0) {
            newVault.deposit(totalAssets, address(this));
        }

        // Revoke approval from old vault
        baseAsset.approve(oldVaultAddr, 0);

        // Update vault reference
        yearnVault = newVault;

        emit YearnVaultMigrated(oldVaultAddr, newYearnVault, totalAssets);
    }

    /**
     * @notice Set the credits token address
     * @param _creditsToken Address of the credits token
     */
    function setCreditsToken(address _creditsToken) external onlyOwner {
        if (_creditsToken == address(0)) revert ZeroAddress();
        creditsToken = ISuiteCredits(_creditsToken);
        emit CreditsTokenSet(_creditsToken);
    }

    /**
     * @notice Update credits bonus multiplier
     * @param newBonusBps New bonus in basis points (10000 = 1x, 12000 = 1.2x)
     */
    function setCreditsBonusBps(uint256 newBonusBps) external onlyOwner {
        uint256 oldBps = creditsBonusBps;
        creditsBonusBps = newBonusBps;
        emit CreditsBonusUpdated(oldBps, newBonusBps);
    }

    /**
     * @notice Update fee settings
     * @param _depositFeeBps New deposit fee (basis points)
     * @param _withdrawFeeBps New withdrawal fee (basis points)
     */
    function setFees(uint256 _depositFeeBps, uint256 _withdrawFeeBps) external onlyOwner {
        if (_depositFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (_withdrawFeeBps > MAX_FEE_BPS) revert FeeTooHigh();

        depositFeeBps = _depositFeeBps;
        withdrawFeeBps = _withdrawFeeBps;

        emit FeesUpdated(_depositFeeBps, _withdrawFeeBps);
    }

    /**
     * @notice Update minimum deposit amount
     * @param _minDeposit New minimum deposit
     */
    function setMinDeposit(uint256 _minDeposit) external onlyOwner {
        minDeposit = _minDeposit;
    }

    /**
     * @notice Update treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /**
     * @notice Withdraw accumulated protocol fees to treasury
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 fees = accumulatedFees;
        if (fees == 0) revert ZeroAmount();

        accumulatedFees = 0;
        baseAsset.safeTransfer(treasury, fees);

        emit FeesWithdrawn(treasury, fees);
    }

    /**
     * @notice Pause deposits (emergency only)
     * @dev Withdrawals still work when paused
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause deposits
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
