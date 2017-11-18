pragma solidity ^0.4.4;

import './math/SafeMath.sol';

contract DepositsManager {
  using SafeMath for uint;

  mapping(address => uint) public deposits;
  uint public jackpot;
  address public owner;

  event DepositMade(address who, uint amount);
  event DepositWithdrawn(address who, uint amount);
  event JackpotIncreased(uint amount);

  // @dev – the constructor
  function DepositsManager() public {
    owner = msg.sender;
    jackpot = 0;
  }
  
  // @dev – fallback to calling makeDeposit when ether is sent directly to contract.
  function() public payable {
    makeDeposit();
  }

  // @dev – returns an account's deposit
  // @param who – the account's address.
  // @return – the account's deposit.
  function getDeposit(address who) constant public returns (uint) {
    return deposits[who];
  }

  // @dev – returns the current jackpot
  // @return – the jackpot.
  function getJackpot() constant public returns (uint) {
    return jackpot;
  }

  // @dev – allows a user to deposit eth.
  // @return – the user's updated deposit amount.
  function makeDeposit() public payable returns (uint) {
    deposits[msg.sender] = deposits[msg.sender].add(msg.value);
    DepositMade(msg.sender, msg.value);
    return deposits[msg.sender];
  }

  // @dev – allows a user to withdraw eth from their deposit.
  // @param amount – how much eth to withdraw
  // @return – the user's updated deposit amount.
  function withdrawDeposit(uint amount) public returns (uint) {
    require(deposits[msg.sender] > amount);

    deposits[msg.sender] = deposits[msg.sender].sub(amount);
    msg.sender.transfer(amount);

    DepositWithdrawn(msg.sender, amount);
    return deposits[msg.sender];
  }

  // @dev – allows a uer to donate to the jackpot.
  // @return – the updated jackpot amount.
  function donateToJackpot() public payable returns (uint) {
    jackpot = jackpot.add(msg.value);
    JackpotIncreased(msg.value);
    return jackpot;
  }
}
