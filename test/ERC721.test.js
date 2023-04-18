// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/8d633cb7d169f2f8595b273660b00b69e845c2fe/test/token/ERC721/ERC721.test.js
const { shouldBehaveLikeERC721, shouldBehaveLikeERC721Metadata } = require('./ERC721.behavior');

const ERC721 = artifacts.require('TestableERC721');

contract('ERC721', function (accounts) {
  const name = 'Non Fungible Token';
  const symbol = 'NFT';

  beforeEach(async function () {
    this.token = await ERC721.new(name, symbol);
  });

  shouldBehaveLikeERC721('ERC721', ...accounts);
  //shouldBehaveLikeERC721Metadata('ERC721', name, symbol, ...accounts);
});
