// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FounderAuction - 24h USDC auction for 30% founder token supply
/// @notice One contract handles unlimited concurrent auctions (keyed by token address).
///         Clanker pre-allocates 30% to this contract. Users bid USDC. After auction ends,
///         winner claims tokens, USDC goes to treasury. Losers withdraw their own USDC.
/// @dev No auto-refunds. Contract only sends on: withdraw (user-initiated), settle (one-time).
///      Anti-snipe: bids in last 5 minutes extend timer by 5 minutes (capped).

contract FounderAuction is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Constants ──

    IERC20 public immutable usdc;
    address public immutable treasury;
    address public owner;

    uint256 public constant ANTI_SNIPE_WINDOW = 5 minutes;
    uint256 public constant ANTI_SNIPE_EXTENSION = 5 minutes;
    uint256 public constant MAX_EXTENSIONS = 12;      // Max 1 hour of extensions
    uint256 public constant MIN_BID_INCREMENT = 1e6;  // $1 USDC (6 decimals)

    // ── Auction State ──

    struct Auction {
        uint256 endTime;
        uint256 minBid;          // Minimum first bid
        address highestBidder;
        uint256 highestBid;
        uint256 extensions;
        bool settled;
        bool cancelled;
    }

    mapping(address => Auction) public auctions;

    // token => bidder => amount deposited
    mapping(address => mapping(address => uint256)) public bids;

    // ── Events ──

    event AuctionStarted(address indexed token, uint256 endTime, uint256 minBid);
    event BidPlaced(address indexed token, address indexed bidder, uint256 totalBid);
    event BidIncreased(address indexed token, address indexed bidder, uint256 addedAmount, uint256 totalBid);
    event BidWithdrawn(address indexed token, address indexed bidder, uint256 amount);
    event AuctionSettled(address indexed token, address indexed winner, uint256 winningBid);
    event AuctionCancelled(address indexed token);

    // ── Constructor ──

    constructor(address _usdc, address _treasury) {
        require(_usdc != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");
        usdc = IERC20(_usdc);
        treasury = _treasury;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ── Start Auction ──

    function startAuction(address token, uint256 duration, uint256 minBid) external onlyOwner {
        Auction storage a = auctions[token];
        require(a.endTime == 0 || a.settled || a.cancelled, "Auction still active");
        require(duration > 0 && duration <= 7 days, "Invalid duration");
        require(minBid >= MIN_BID_INCREMENT, "Min bid too low");
        require(IERC20(token).balanceOf(address(this)) > 0, "No tokens to auction");

        auctions[token] = Auction({
            endTime: block.timestamp + duration,
            minBid: minBid,
            highestBidder: address(0),
            highestBid: 0,
            extensions: 0,
            settled: false,
            cancelled: false
        });

        emit AuctionStarted(token, block.timestamp + duration, minBid);
    }

    // ── Place Bid (first bid) ──

    function bid(address token, uint256 amount) external nonReentrant {
        Auction storage a = auctions[token];
        require(a.endTime > 0, "No auction");
        require(!a.cancelled, "Auction cancelled");
        require(block.timestamp < a.endTime, "Auction ended");
        require(bids[token][msg.sender] == 0, "Already bidding - use increaseBid");
        require(amount >= a.minBid, "Below minimum bid");
        require(amount > a.highestBid, "Must beat current highest bid");

        // Pull USDC from bidder
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Record bid
        bids[token][msg.sender] = amount;

        // Update highest
        a.highestBidder = msg.sender;
        a.highestBid = amount;

        // Anti-snipe
        if (a.endTime - block.timestamp < ANTI_SNIPE_WINDOW && a.extensions < MAX_EXTENSIONS) {
            a.endTime += ANTI_SNIPE_EXTENSION;
            a.extensions++;
        }

        emit BidPlaced(token, msg.sender, amount);
    }

    // ── Increase Bid ──

    function increaseBid(address token, uint256 additionalAmount) external nonReentrant {
        Auction storage a = auctions[token];
        require(a.endTime > 0, "No auction");
        require(!a.cancelled, "Auction cancelled");
        require(block.timestamp < a.endTime, "Auction ended");
        require(bids[token][msg.sender] > 0, "No existing bid - use bid");
        require(additionalAmount >= MIN_BID_INCREMENT, "Increase too small");

        // Pull additional USDC
        usdc.safeTransferFrom(msg.sender, address(this), additionalAmount);

        // Update bid total
        uint256 newTotal = bids[token][msg.sender] + additionalAmount;
        bids[token][msg.sender] = newTotal;

        // Update highest if this bidder is now on top
        if (newTotal > a.highestBid) {
            a.highestBidder = msg.sender;
            a.highestBid = newTotal;

            // Anti-snipe
            if (a.endTime - block.timestamp < ANTI_SNIPE_WINDOW && a.extensions < MAX_EXTENSIONS) {
                a.endTime += ANTI_SNIPE_EXTENSION;
                a.extensions++;
            }
        }

        emit BidIncreased(token, msg.sender, additionalAmount, newTotal);
    }

    // ── Withdraw (losers pull their USDC back) ──

    function withdraw(address token) external nonReentrant {
        Auction storage a = auctions[token];
        uint256 amount = bids[token][msg.sender];
        require(amount > 0, "No bid to withdraw");

        if (a.cancelled) {
            // Anyone can withdraw if cancelled
        } else {
            // Can only withdraw if you're NOT the highest bidder
            require(msg.sender != a.highestBidder, "Highest bidder cannot withdraw");
            // Can withdraw during or after auction (losers can exit anytime)
        }

        // Clear bid and send
        bids[token][msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);

        emit BidWithdrawn(token, msg.sender, amount);
    }

    // ── Settle ──

    function settle(address token) external nonReentrant {
        Auction storage a = auctions[token];
        require(a.endTime > 0, "No auction");
        require(!a.cancelled, "Auction cancelled");
        require(block.timestamp >= a.endTime, "Auction not ended");
        require(!a.settled, "Already settled");

        a.settled = true;

        if (a.highestBidder != address(0) && a.highestBid > 0) {
            // Clear winner's bid balance (so they can't withdraw)
            bids[token][a.highestBidder] = 0;

            // Send winning USDC to treasury
            usdc.safeTransfer(treasury, a.highestBid);

            // Send tokens to winner
            uint256 tokenBalance = IERC20(token).balanceOf(address(this));
            if (tokenBalance > 0) {
                IERC20(token).safeTransfer(a.highestBidder, tokenBalance);
            }

            emit AuctionSettled(token, a.highestBidder, a.highestBid);
        } else {
            // No bids - return tokens to treasury
            uint256 tokenBalance = IERC20(token).balanceOf(address(this));
            if (tokenBalance > 0) {
                IERC20(token).safeTransfer(treasury, tokenBalance);
            }

            emit AuctionSettled(token, address(0), 0);
        }
    }

    // ── Emergency Cancel ──

    function cancelAuction(address token) external onlyOwner nonReentrant {
        Auction storage a = auctions[token];
        require(a.endTime > 0, "No auction");
        require(!a.settled, "Already settled");

        a.cancelled = true;

        // Return tokens to treasury
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        if (tokenBalance > 0) {
            IERC20(token).safeTransfer(treasury, tokenBalance);
        }

        // Bidders withdraw their own USDC via withdraw()

        emit AuctionCancelled(token);
    }

    // ── Views ──

    function getAuction(address token) external view returns (
        uint256 endTime,
        uint256 minBid,
        address highestBidder,
        uint256 highestBid,
        uint256 extensions,
        bool settled,
        bool cancelled,
        uint256 tokenBalance
    ) {
        Auction storage a = auctions[token];
        return (
            a.endTime,
            a.minBid,
            a.highestBidder,
            a.highestBid,
            a.extensions,
            a.settled,
            a.cancelled,
            IERC20(token).balanceOf(address(this))
        );
    }

    function getBid(address token, address bidder) external view returns (uint256) {
        return bids[token][bidder];
    }

    function isActive(address token) external view returns (bool) {
        Auction storage a = auctions[token];
        return a.endTime > 0 && !a.settled && !a.cancelled && block.timestamp < a.endTime;
    }

    function timeRemaining(address token) external view returns (uint256) {
        Auction storage a = auctions[token];
        if (a.endTime == 0 || block.timestamp >= a.endTime) return 0;
        return a.endTime - block.timestamp;
    }

    // ── Admin ──

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    function rescueToken(address token, uint256 amount) external onlyOwner {
        Auction storage a = auctions[token];
        require(a.settled || a.cancelled || a.endTime == 0, "Auction active");
        IERC20(token).safeTransfer(treasury, amount);
    }
}
