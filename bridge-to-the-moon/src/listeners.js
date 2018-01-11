function depositListeners(claimManager) {
	let depositBondedEvent = claimManager.DepositBonded();
	depositBondedEvent.watch((error, result) => {
		console.log(result);
	})	
	let depositUnbondedEvent = claimManager.DepositUnbonded();
	depositUnbondedEvent.watch((error, result) => {
		console.log(result);
	})	
	let depositMadeEvent = claimManager.DepositMade();
	depositMadeEvent.watch((error, result) => {
		console.log(result);
	})	
	let depositWithdrawnEvent = claimManager.DepositWithdrawn();
	depositWithdrawnEvent.watch((error, result) => {
		console.log(result);
	})
}

function claimListeners(claimManager) {
 
	let claimCreatedEvent = claimManager.ClaimCreated();
	claimCreatedEvent.watch((error, result) => {
		console.log(result);
	})	
	let claimChallengedEvent = claimManager.ClaimChallenged();
	claimChallengedEvent.watch((error, result) => {
		console.log(result);
	})	
	let claimVerificationGameStartedEvent = claimManager.ClaimVerificationGameStarted();
	claimVerificationGameStartedEvent.watch((error, result) => {
		console.log(result);
	})	
	let claimVerificationGameEndedEvent = claimManager.ClaimVerificationGamesEnded();
	claimVerificationGameEndedEvent.watch((error, result) => {
		console.log(result);
	})	
	let claimSuccessfulEvent = claimManager.ClaimSuccessful();
	claimSuccessfulEvent.watch((error, result) => {
		console.log(result);
	})
}

function sessionListeners(claimManager) {
	let sessionDecidedEvent = claimManager.SessionDecided();
	sessionDecidedEvent.watch((error, result) => {
		console.log(result);
	})
}

function turnOnListeners(api) {
	return (claimManager, scryptVerifier) => {
		depositListeners(claimManager);
		claimListeners(claimManager);
		sessionListeners(claimManager);
	}
}

module.exports = async (web3, contractAddresses) => {
	const api = await require('./api')(web3, contractAddresses)

	return {
		turnOnListeners: turnOnListeners(api)
	}
}