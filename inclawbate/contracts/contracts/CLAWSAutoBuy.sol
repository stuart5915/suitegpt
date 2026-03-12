// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUniswapV2Router {
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

interface AutomationCompatibleInterface {
    function checkUpkeep(bytes calldata checkData)
        external returns (bool upkeepNeeded, bytes memory performData);
    function performUpkeep(bytes calldata performData) external;
}

/// @title CLAWSAutoBuy - DCA into $CLAWS on Base
/// @notice Deposit ETH, split into N buys over time. Free to use.
contract CLAWSAutoBuy is AutomationCompatibleInterface {
    IUniswapV2Router public immutable router;
    address public immutable WETH;
    address public immutable CLAWS;

    struct Position {
        uint128 remaining;
        uint128 amountPerBuy;
        uint32  intervalSeconds;
        uint32  lastBuyTime;
        uint16  buysCompleted;
        uint16  totalBuys;
        uint128 totalClawsBought;
        bool    active;
    }

    mapping(address => Position) public positions;
    address[] public activeUsers;

    uint256 public constant SLIPPAGE_BPS = 1000; // 10%

    event Deposited(address indexed user, uint256 amount, uint16 numBuys, uint32 interval);
    event BuyExecuted(address indexed user, uint256 ethSpent, uint256 clawsReceived, uint16 buyNumber);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(address _router, address _weth, address _claws) {
        router = IUniswapV2Router(_router);
        WETH = _weth;
        CLAWS = _claws;
    }

    /// @notice Deposit ETH to DCA into CLAWS
    /// @param numBuys Number of buys to split across (2-1000)
    /// @param intervalSeconds Seconds between each buy (600 = 10min, 3600 = 1hr)
    function deposit(uint16 numBuys, uint32 intervalSeconds) external payable {
        require(msg.value > 0, "Send ETH");
        require(numBuys >= 2 && numBuys <= 1000, "2-1000 buys");
        require(intervalSeconds >= 600, "Min 10 minutes");
        require(!positions[msg.sender].active, "Already active - withdraw first");

        uint128 perBuy = uint128(msg.value / numBuys);
        require(perBuy > 0, "Amount too small");

        positions[msg.sender] = Position({
            remaining: uint128(msg.value),
            amountPerBuy: perBuy,
            intervalSeconds: intervalSeconds,
            lastBuyTime: 0,
            buysCompleted: 0,
            totalBuys: numBuys,
            totalClawsBought: 0,
            active: true
        });

        activeUsers.push(msg.sender);
        emit Deposited(msg.sender, msg.value, numBuys, intervalSeconds);
    }

    /// @notice Execute next buy for a user. Anyone can call this.
    function executeBuy(address user) external {
        Position storage pos = positions[user];
        require(pos.active, "Not active");
        require(pos.buysCompleted < pos.totalBuys, "Already complete");
        require(pos.remaining >= pos.amountPerBuy, "Insufficient balance");
        require(
            pos.lastBuyTime == 0 || block.timestamp >= uint256(pos.lastBuyTime) + uint256(pos.intervalSeconds),
            "Too early"
        );

        uint256 buyAmount = pos.amountPerBuy;

        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = CLAWS;

        uint256[] memory expected = router.getAmountsOut(buyAmount, path);
        uint256 minOut = expected[1] * (10000 - SLIPPAGE_BPS) / 10000;

        uint256[] memory result = router.swapExactETHForTokens{value: buyAmount}(
            minOut,
            path,
            user,
            block.timestamp + 300
        );

        pos.remaining -= uint128(buyAmount);
        pos.buysCompleted++;
        pos.lastBuyTime = uint32(block.timestamp);
        pos.totalClawsBought += uint128(result[1]);

        emit BuyExecuted(user, buyAmount, result[1], pos.buysCompleted);

        if (pos.buysCompleted >= pos.totalBuys) {
            _complete(user);
        }
    }

    // -- Chainlink Automation (also works with Vercel cron) --

    /// @notice Check if any buys are ready to execute
    function checkUpkeep(bytes calldata)
        external view override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256 len = activeUsers.length;
        for (uint256 i = 0; i < len; i++) {
            if (_isReady(activeUsers[i])) {
                return (true, "");
            }
        }
        return (false, "");
    }

    /// @notice Execute all ready buys (called by Chainlink or cron)
    function performUpkeep(bytes calldata) external override {
        _executeReady();
    }

    /// @notice Manual trigger - same as performUpkeep
    function executeAll() external {
        _executeReady();
    }

    // -- User actions --

    /// @notice Withdraw remaining ETH and stop DCA
    function withdraw() external {
        Position storage pos = positions[msg.sender];
        require(pos.active, "Not active");

        uint256 amount = pos.remaining;
        pos.remaining = 0;
        pos.active = false;
        _removeUser(msg.sender);

        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    // -- View functions --

    /// @notice Get full position data for a user
    function getPosition(address user) external view returns (
        uint256 remaining,
        uint256 amountPerBuy,
        uint256 intervalSeconds,
        uint256 lastBuyTime,
        uint256 buysCompleted,
        uint256 totalBuys,
        uint256 totalClawsBought,
        bool active,
        uint256 nextBuyTime
    ) {
        Position storage p = positions[user];
        uint256 next = 0;
        if (p.active && p.buysCompleted < p.totalBuys) {
            next = p.lastBuyTime == 0 ? block.timestamp : uint256(p.lastBuyTime) + uint256(p.intervalSeconds);
        }
        return (p.remaining, p.amountPerBuy, p.intervalSeconds, p.lastBuyTime, p.buysCompleted, p.totalBuys, p.totalClawsBought, p.active, next);
    }

    /// @notice Get all users whose next buy is ready
    function getReadyUsers() external view returns (address[] memory) {
        uint256 count = 0;
        uint256 len = activeUsers.length;
        for (uint256 i = 0; i < len; i++) {
            if (_isReady(activeUsers[i])) count++;
        }
        address[] memory ready = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < len; i++) {
            if (_isReady(activeUsers[i])) ready[idx++] = activeUsers[i];
        }
        return ready;
    }

    function activeUserCount() external view returns (uint256) {
        return activeUsers.length;
    }

    // -- Internal --

    function _executeReady() internal {
        uint256 len = activeUsers.length;
        if (len == 0) return;
        for (uint256 i = len; i > 0; i--) {
            address user = activeUsers[i - 1];
            if (_isReady(user)) {
                try this.executeBuy(user) {} catch {}
            }
        }
    }

    function _isReady(address user) internal view returns (bool) {
        Position storage p = positions[user];
        return p.active && p.buysCompleted < p.totalBuys && p.remaining >= p.amountPerBuy &&
            (p.lastBuyTime == 0 || block.timestamp >= uint256(p.lastBuyTime) + uint256(p.intervalSeconds));
    }

    function _complete(address user) internal {
        Position storage pos = positions[user];
        pos.active = false;
        if (pos.remaining > 0) {
            uint256 dust = pos.remaining;
            pos.remaining = 0;
            payable(user).transfer(dust);
        }
        _removeUser(user);
    }

    function _removeUser(address user) internal {
        uint256 len = activeUsers.length;
        for (uint256 i = 0; i < len; i++) {
            if (activeUsers[i] == user) {
                activeUsers[i] = activeUsers[len - 1];
                activeUsers.pop();
                break;
            }
        }
    }

    receive() external payable {}
}
