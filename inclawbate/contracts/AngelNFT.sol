// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract AngelNFT is ERC721, Ownable {
    IERC20 public immutable inclawnch;
    bytes32 public immutable merkleRoot;

    mapping(address => bool) public hasMinted;
    uint256 public totalMinted;

    string private _baseTokenURI;

    event Minted(address indexed to, uint256 tokenId, uint256 inclawnchAmount);

    constructor(
        address _inclawnch,
        bytes32 _merkleRoot,
        string memory baseTokenURI_
    ) ERC721("Inclawbate Angel", "ANGEL") Ownable(msg.sender) {
        inclawnch = IERC20(_inclawnch);
        merkleRoot = _merkleRoot;
        _baseTokenURI = baseTokenURI_;
    }

    function mint(uint256 amount, bytes32[] calldata proof) external {
        require(!hasMinted[msg.sender], "Already minted");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");

        require(
            inclawnch.transferFrom(msg.sender, address(this), amount),
            "INCLAWNCH transfer failed"
        );

        hasMinted[msg.sender] = true;
        totalMinted++;

        _safeMint(msg.sender, totalMinted);

        emit Minted(msg.sender, totalMinted, amount);
    }

    function withdrawInclawnch(address to) external onlyOwner {
        uint256 balance = inclawnch.balanceOf(address(this));
        require(balance > 0, "No INCLAWNCH to withdraw");
        inclawnch.transfer(to, balance);
    }

    function setBaseURI(string memory baseTokenURI_) external onlyOwner {
        _baseTokenURI = baseTokenURI_;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
