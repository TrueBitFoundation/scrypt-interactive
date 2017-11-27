/**
 * implements a state machine for carrying out the verification game
 *   from the challenger's perspective
 */

const StateMachine = require('javascript-state-machine')
const waitForEvent = require('../utils/waitForEvent')
const { calculateMidpoint } = require('../utils/math')

module.exports = (web3, api) => ({
  run: async (cmd, claim, sessionId) => new Promise(async (resolve, reject) => {
    try {
      const m = new StateMachine({
        init: 'init',
        transitions: [
          { name: 'query', from: ['init', 'preRespond'], to: 'preRespond' },
          { name: 'finish', from: ['preRespond'], to: 'preFinish' },
          { name: 'didConvict', from: '*', to: 'convicted' },
        ],
        methods: {
          onBeforeQuery: async (tsn) => {
            cmd.log('Syncing Session State...')
            const session = await api.getSession(claim.id)
            cmd.log('Synced.')

            // let's check the most recent submission
            let newMedStep
            if (session.medStep.eq(0)) {
              // is this the first query? we don't have a submission to check
              // so we'll just go in the middle
              cmd.log('This is the first query()')
              
              newMedStep = calculateMidpoint(session.lowStep, session.highStep)
            } else {
              // otherwise, let's see if the session.medHash is right or not
              const result = await api.getResult(session.input, session.medStep)
              if (result.stateHash === session.medHash) {
                cmd.log(`The claimant's answer of ${session.medHash} DID equal our calculation of ${result.stateHash} so the error must be after step ${session.medStep}`)
                // the claimant is right at least up to the current medStep
                // so the issue is somewhere between (medStep, highStep]
                newMedStep = calculateMidpoint(session.medStep, session.highStep)
              } else {
                cmd.log(`The claimant's answer of ${session.medHash} did NOT equal our calculation of ${result.stateHash} so the error must be before (or at) step ${session.medStep}`)
                // otherwise the claimant is wrong somewhere between [0, medStep]
                newMedStep = calculateMidpoint(session.lowStep, session.medStep)
              }
            }

            cmd.log(`Requesting a stateHash for step ${newMedStep}`)

            // now lets request the next medStep
            await api.query(claim.id, newMedStep)
          },
          onEnterPreRespond: async (tsn) => {
            cmd.log('Waiting for a respond(), timeout(), or conviction event...')
            return Promise.race([
              // either the claimant responds with a respond()
              waitForEvent(api.scryptVerifier, 'NewResponse', { filter: { sessionId } })
                .then(() => cmd.log('Got NewResponse()'))
                // in which case we want to query and wait again
                .then(() => tsn.fsm.query()),

              // or the claimant can be convicted by a timeout or fold
              waitForEvent(api.scryptVerifier, 'ClaimantConvicted', { filter: { sessionId } })
                .then(() => cmd.log('Got ClaimantConvicted()'))
                // in which case we want to go to the convicted state
                .then(() => tsn.fsm.didConvict()),

              // or we can be convicted
              waitForEvent(api.scryptVerifier, 'ChallengerConvicted', { filter: { sessionId } })
                .then(() => cmd.log('Got ChallengerConvicted()'))
                // in which case we want to go to the convicted state
                .then(() => tsn.fsm.didConvict()),
            ])
          },
          onEnterConvicted: async (tsn, didWin) => {
            resolve(didWin)
          },
        },
      })

      cmd.log('Playing the Verification Game...')
      await m.query()
      cmd.log('Done Playing Verification Game!')
    } catch (error) {
      reject(error)
    }
  }),
})
