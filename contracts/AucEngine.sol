// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

contract AucEngine {
    address public owner;
    uint constant public DEFAULT_DURATION = 2 days;
    uint public constant FEE = 10; // 10%

    struct Auction {
        address payable seller;
        uint startingPrice;
        uint finalPrice;
        uint startAt;
        uint endsAt;
        uint discountRate;
        string item;
        bool stopped;
    }

    Auction[] public auctions;

    event AuctionCreated(uint index, string itemName, uint startingPrice, uint duration);
    event AuctionEnded(uint index, uint finalPrice, address winner);
    event AuctionRefund(uint index, uint value, address winner);
    event AuctionStopped(uint index);

    constructor() {
        owner = msg.sender;
    }

    function createAuction(uint _startingPrice, uint _discountRate, string calldata _item, uint _duration) external {
        uint duration = _duration == 0 ? DEFAULT_DURATION : _duration;

        require(_startingPrice >= _discountRate * duration, "incorrect starting price");

        Auction memory newAuction = Auction({
            seller: payable(msg.sender),
            startingPrice: _startingPrice,
            finalPrice: _startingPrice,
            startAt: block.timestamp,
            endsAt: block.timestamp + duration,
            discountRate: _discountRate,
            item: _item,
            stopped: false
        });

        auctions.push(newAuction);

        emit AuctionCreated(auctions.length - 1, _item, _startingPrice, duration);
    }

    function buy(uint index) external payable {
        Auction storage cAuction = auctions[index];

        require(!cAuction.stopped, "stopped!");
        require(block.timestamp < cAuction.endsAt, "ended!");

        uint cPrice = getPriceFor(index);

        require(msg.value >= cPrice, "not enough funds!");

        cAuction.stopped = true;
        cAuction.finalPrice = cPrice;

        uint refund = msg.value - cPrice;

        if (refund > 0) {
            payable(msg.sender).transfer(refund);
            emit AuctionRefund(index, refund, msg.sender);
        }

        cAuction.seller.transfer(
            cPrice - ((cPrice * FEE) / 100)
        );

        emit AuctionEnded(index, cPrice, msg.sender);
    }

    function stop(uint index) external {
        Auction storage cAuction = auctions[index];

        require(msg.sender == cAuction.seller, "access is denied!");
        require(!cAuction.stopped, "auction already was stopped!");

        cAuction.stopped = true;

        emit AuctionStopped(index);
    }

    function getPriceFor(uint index) public view returns(uint) {
        Auction memory cAuction = auctions[index];

        require(!cAuction.stopped, "stopped!");

        return cAuction.startingPrice - cAuction.discountRate * (block.timestamp - cAuction.startAt);
    }
}