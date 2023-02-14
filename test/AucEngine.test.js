const { expect } = require("chai")
const { ethers } = require("hardhat")
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers")

describe("AucEngine", function() {
    let startingPrice = ethers.utils.parseEther("0.0001")
    let discountRate = 3
    let item = "fake item"
    let duration = 60

    async function deployFixture() {
        [owner, seller, buyer] = await ethers.getSigners()

        const AucEngine = await ethers.getContractFactory("AucEngine", owner)
        auct = await AucEngine.deploy()
        await auct.deployed()

        return {owner, seller, buyer, auct}
    }

    async function getTimestamp(bn) {
        return (
            await ethers.provider.getBlock(bn)
        ).timestamp
    }

    async function createAuction(auct, seller, isDefaultDuration = false) {
        return await auct.connect(seller).createAuction(
            startingPrice,
            discountRate,
            item,
            !isDefaultDuration ? duration : 0
        )
    }

    it("sets owner", async function() {
        const {auct, owner} = await loadFixture(deployFixture)
        
        const currentOwner = await auct.owner()
        expect(currentOwner).to.eq(owner.address)
    })

    describe("createAuction", function() {
        it("creating auction is correctly", async function() {
            const {seller, auct} = await loadFixture(deployFixture)

            const tx = await createAuction(auct, seller)
            const cAuction = await auct.auctions(0)
            const ts = await getTimestamp(tx.blockNumber)
            
            expect(cAuction.seller).to.eq(seller.address)
            expect(cAuction.startingPrice).to.eq(startingPrice)
            expect(cAuction.finalPrice).to.eq(startingPrice)
            expect(cAuction.startAt).to.eq(ts)
            expect(cAuction.endsAt).to.eq(ts + duration)
            expect(cAuction.discountRate).to.eq(discountRate)
            expect(cAuction.item).to.eq(item)
            expect(cAuction.stopped).to.eq(false)

            await expect(tx)
                .to.emit(auct, 'AuctionCreated')
                .withArgs(0, item, startingPrice, duration)
        })

        it("creating auction with default duration", async function() {
            const {seller, auct} = await loadFixture(deployFixture)

            const tx = await createAuction(auct, seller, true)
            const cAuction = await auct.auctions(0)
            const ts = await getTimestamp(tx.blockNumber)
            const duration = parseInt(await auct.DEFAULT_DURATION())

            expect(cAuction.seller).to.eq(seller.address)
            expect(cAuction.startingPrice).to.eq(startingPrice)
            expect(cAuction.finalPrice).to.eq(startingPrice)
            expect(cAuction.startAt).to.eq(ts)
            expect(cAuction.endsAt).to.eq(ts + duration)
            expect(cAuction.discountRate).to.eq(discountRate)
            expect(cAuction.item).to.eq(item)
            expect(cAuction.stopped).to.eq(false)
        })

        it("creating auction is not correctly", async function() {
            const {seller, auct} = await loadFixture(deployFixture)

            await expect(
                auct.connect(seller).createAuction(
                    startingPrice,
                    10000000000,
                    item,
                    1000000
                )
            ).to.be.revertedWith('incorrect starting price')
        })
    })

    describe("buy", function() {
        it("successful buying with refund", async function() {
            const {seller, buyer, auct} = await loadFixture(deployFixture)

            await createAuction(auct, seller)

            await time.increase(duration - 5)

            const value = ethers.utils.parseEther("0.0001")
            const buyTx = await auct.connect(buyer).buy(0, {value: value})

            const cAuction = await auct.auctions(0)
            const finalPrice = cAuction.finalPrice

            await expect(() => buyTx).to.changeEtherBalance(
                seller, finalPrice - Math.floor((finalPrice * (await auct.FEE())) / 100)
            )

            await expect(() => buyTx).to.changeEtherBalance(
                buyer, -finalPrice
            )

            await expect(buyTx)
                .to.emit(auct, 'AuctionRefund')
                .withArgs(0, value - finalPrice, buyer.address)

            await expect(buyTx)
                .to.emit(auct, 'AuctionEnded')
                .withArgs(0, finalPrice, buyer.address)
        })

        it("successful buying without refund", async function() {
            const {seller, buyer, auct} = await loadFixture(deployFixture)

            await createAuction(auct, seller)

            await time.setNextBlockTimestamp((await time.latest()) + 5)

            const buyTx = await auct.connect(buyer).buy(0, {value: startingPrice - discountRate * 5})

            await expect(buyTx).not.to.emit(auct, 'AuctionRefund')
        })

        it("access is denied to repeat buy", async function() {
            const {seller, buyer, auct} = await loadFixture(deployFixture)

            await createAuction(auct, seller)

            await auct.connect(buyer).buy(0, {value: ethers.utils.parseEther("0.0001")})

            await expect(
                auct.connect(buyer).buy(0, {value: ethers.utils.parseEther("0.0001")})
            ).to.be.revertedWith('stopped!')
        })

        it("access is denied after stopping by seller", async function() {
            const {seller, buyer, auct} = await loadFixture(deployFixture)

            await createAuction(auct, seller)

            await auct.connect(seller).stop(0)

            await expect(
                auct.connect(buyer).buy(0, {value: ethers.utils.parseEther("0.0001")})
            ).to.be.revertedWith('stopped!')
        })

        it("time is over", async function() {
            const {seller, buyer, auct} = await loadFixture(deployFixture)

            await createAuction(auct, seller)

            await time.increase(duration + 5)

            await expect(
                auct.connect(buyer).buy(0, {value: ethers.utils.parseEther("0.0001")})
            ).to.be.revertedWith('ended!')
        })

        it("not enough funds", async function() {
            const {seller, buyer, auct} = await loadFixture(deployFixture)

            await createAuction(auct, seller)

            await expect(
                auct.connect(buyer).buy(0, {value: ethers.utils.parseEther("0.00001")})
            ).to.be.revertedWith('not enough funds!')
        })
    })

    describe("stop", function() {
        it("access is allows to stop for seller", async function() {
            const {seller, auct} = await loadFixture(deployFixture)

            await createAuction(auct, seller)

            const stopTx = await auct.connect(seller).stop(0)
            const cAuction = await auct.auctions(0)

            expect(cAuction.stopped).to.eq(true)

            await expect(stopTx)
                .to.emit(auct, 'AuctionStopped')
                .withArgs(0)
            
            await expect(
                auct.connect(seller).stop(0)
            ).to.be.revertedWith('auction already was stopped!')
        })

        it("access is denied to stop for other", async function() {
            const {seller, auct} = await loadFixture(deployFixture)

            await createAuction(auct, seller)

            await expect(
                auct.stop(0)
            ).to.be.revertedWith('access is denied!')
        })

        it("access is denied to repeat stop", async function() {
            const {seller, auct} = await loadFixture(deployFixture)

            await createAuction(auct, seller)

            await auct.connect(seller).stop(0)

            await expect(
                auct.connect(seller).stop(0)
            ).to.be.revertedWith('auction already was stopped!')
        })
    })

    describe("getPriceFor", function() {
        it("get price", async function() {
            const {seller, auct} = await loadFixture(deployFixture)

            await createAuction(auct, seller)

            const cPrice = await auct.getPriceFor(0)

            expect(cPrice).to.eq(startingPrice)
        })

        it("get price by time", async function() {
            const {seller, auct} = await loadFixture(deployFixture)

            await createAuction(auct, seller)

            const cAuction = await auct.auctions(0)

            const timestampNewBlock = (await time.latest()) + duration - 5
            await time.increaseTo(timestampNewBlock)

            const cPrice = await auct.getPriceFor(0)

            expect(cPrice).to.eq(cAuction.startingPrice - cAuction.discountRate * (timestampNewBlock - cAuction.startAt))
        })

        it("get price for stopped auction", async function() {
            const {seller, auct} = await loadFixture(deployFixture)

            await createAuction(auct, seller)

            await auct.connect(seller).stop(0)

            await expect(
                auct.getPriceFor(0)
            ).to.be.revertedWith('stopped!')
        })
    })
})