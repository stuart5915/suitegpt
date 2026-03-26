// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FounderAuction — 24h USDC auction for 30% founder token supply
/// @notice One contract handles unlimited concurrent auctions (keyed by token address).
///         Clanker pre-allocates 30% to this contract. After auction ends, winner claims
///         tokens + USDC goes to treasury. Previous bidders auto-refunded on outbid.
/// @dev Anti-snipe: bids in last 5 minutes extend timer by 5 minutes.

contract FounderAuction is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Constants ──

    IERC20 public immutable usdc;
    address public immutable treasury;  // Inclawbate treasury receives USDC
    address public owner;

    uint256 public constant ANTI_SNIPE_WINDOW = 5 minutes;
    uint256 public constant ANTI_SNIPE_EXTENSION = 5 minutes;
    uint256 public constant MIN_BID_INCREMENT = 10e6; // $10 USDC (6 decimals)

    // ── Auction State ──

    struct Auction {
        address seller;          // Who started the auction (usually Inclawbate)
        uint256 endTime;         // When auction ends (unix timestamp)
        uint256 minBid;          // Minimum first bid (USDC, 6 decimals)
        address highestBidder;   // Current winning address
        uint256 highestBid;      // Current winning bid (USDC, 6 decimals)
        bool settled;            // Whether winner has claimed
        bool cancelled;          // Emergency cancel
    }

    // tokenAddress => Auction
    mapping(address => Auction) public auctions;

    // ── Events ──

    event AuctionStarted(address indexed token, uint256 endTime, uint256 minBid);
    event BidPlaced(address indexed token, address indexed bidder, uint256 amount);
    event BidRefunded(address indexed token, address indexed bidder, uint256 amount);
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
    /// @notice Start a new auction for a token. The contract must already hold
    ///         the 30% allocation (sent by Clanker pre-allocation).
    /// @param token The token being auctioned
    /// @param duration Auction duration in seconds (default: 86400 = 24h)
    /// @param minBid Minimum first bid in USDC (6 decimals, e.g. 50e6 = $50)
    function startAuction(address token, uint256 duration, uint256 minBid) external onlyOwner {
        require(auctions[token].endTime == 0, "Auction already exists");
        require(duration > 0 && duration <= 7 days, "Invalid duration");
        require(IERC20(token).balanceOf(address(this)) > 0, "No tokens to auction");

        auctions[token] = Auction({
            seller: msg.sender,
            endTime: block.timestamp + duration,
            minBid: minBid,
            highestBidder: address(0),
            highestBid: 0,
            settled: false,
            cancelled: false
        });

        emit AuctionStarted(token, block.timestamp + duration, minBid);
    }

    // ── Place Bid ──
    /// @notice Bid USDC on an active auction. Must approve this contract first.
    ///         Previous highest bidder is automatically refunded.
    /// @param token The token auction to bid on
    /// @param amount USDC amount to bid (6 decimals)
    function bid(address token, uint256 amount) external nonReentrant {
        Auction storage a = auctions[token];
        require(a.endTime > 0, "No auction");
        require(!a.cancelled, "Auction cancelled");
        require(block.timestamp < a.endTime, "Auction ended");

        // Must beat current bid by minimum increment
        if (a.highestBid == 0) {
            require(amount >= a.minBid, "Below minimum bid");
        } else {
            require(amount >= a.highestBid + MIN_BID_INCREMENT, "Bid too low");
        }

        // Refund previous bidder
        if (a.highestBidder != address(0) && a.highestBid > 0) {
            usdc.safeTransfer(a.highestBidder, a.highestBid);
            emit BidRefunded(token, a.highestBidder, a.highestBid);
        }

        // Pull USDC from new bidder
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Update auction state
        a.highestBidder = msg.sender;
        a.highestBid = amount;

        // Anti-snipe: extend if bid is in last 5 minutes
        if (a.endTime - block.timestamp < ANTI_SNIPE_WINDOW) {
            a.endTime += ANTI_SNIPE_EXTENSION;
        }

        emit BidPlaced(token, msg.sender, amount);
    }

    // ── Settle (claim) ──
    /// @notice After auction ends, winner calls this to receive tokens.
    ///         USDC goes to treasury. Anyone can call (permissionless settlement).
    /// @param token The token auction to settle
    function settle(address token) external nonReentrant {
        Auction storage a = auctions[token];
        require(a.endTime > 0, "No auction");
        require(!a.cancelled, "Auction cancelled");
        require(block.timestamp >= a.endTime, "Auction not ended");
        require(!a.settled, "Already settled");

        a.settled = true;

        if (a.highestBidder != address(0) && a.highestBid > 0) {
            // Send USDC to treasury
            usdc.safeTransfer(treasury, a.highestBid);

            // Send ALL tokens held for this auction to winner
            uint256 tokenBalance = IERC20(token).balanceOf(address(this));
            if (tokenBalance > 0) {
                IERC20(token).safeTransfer(a.highestBidder, tokenBalance);
            }

            emit AuctionSettled(token, a.highestBidder, a.highestBid);
        } else {
            // No bids — return tokens to treasury
            uint256 tokenBalance = IERC20(token).balanceOf(address(this));
            if (tokenBalance > 0) {
                IERC20(token).safeTransfer(treasury, tokenBalance);
            }

            emit AuctionSettled(token, address(0), 0);
        }
    }

    // ── Emergency Cancel ──
    /// @notice Owner can cancel an auction. Refunds highest bidder, returns tokens.
    /// @param token The token auction to cancel
    function cancelAuction(address token) external onlyOwner nonReentrant {
        Auction storage a = auctions[token];
        require(a.endTime > 0, "No auction");
        require(!a.settled, "Already settled");

        a.cancelled = true;

        // Refund highest bidder
        if (a.highestBidder != address(0) && a.highestBid > 0) {
            usdc.safeTransfer(a.highestBidder, a.highestBid);
            emit BidRefunded(token, a.highestBidder, a.highestBid);
        }

        // Return tokens to treasury
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        if (tokenBalance > 0) {
            IERC20(token).safeTransfer(treasury, tokenBalance);
        }

        emit AuctionCancelled(token);
    }

    // ── Views ──

    /// @notice Get full auction state for a token
    function getAuction(address token) external view returns (
        address seller,
        uint256 endTime,
        uint256 minBid,
        address highestBidder,
        uint256 highestBid,
        bool settled,
        bool cancelled,
        uint256 tokenBalance
    ) {
        Auction storage a = auctions[token];
        return (
            a.seller,
            a.endTime,
            a.minBid,
            a.highestBidder,
            a.highestBid,
            a.settled,
            a.cancelled,
            IERC20(token).balanceOf(address(this))
        );
    }

    /// @notice Check if an auction is currently active
    function isActive(address token) external view returns (bool) {
        Auction storage a = auctions[token];
        return a.endTime > 0 && !a.settled && !a.cancelled && block.timestamp < a.endTime;
    }

    /// @notice Time remaining in seconds (0 if ended)
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

    /// @notice Rescue stuck tokens that aren't part of any active auction
    function rescueToken(address token, uint256 amount) external onlyOwner {
        Auction storage a = auctions[token];
        require(a.settled || a.cancelled || a.endTime == 0, "Auction active");
        IERC20(token).safeTransfer(treasury, amount);
    }
}
