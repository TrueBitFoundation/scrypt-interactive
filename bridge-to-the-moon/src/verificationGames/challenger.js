/**
 * implements a state machine for carrying out the verification game
 *   from the challenger's perspective
 */

const StateMachine = require('javascript-state-machine')
const waitForEvent = require('../utils/waitForEvent')

module.exports = (web3, api) => ({
  run: async (cmd, claim, sessionId) => new Promise(async (resolve, reject) => {
    const { scryptVerifier } = api
    try {
      let session
      let step = 1

      // onBefore, onEnter, onLeave, onAfter
      const m = new StateMachine({
        init: 'init',
        transitions: [
          { name: 'query', from: ['init', 'preRespond'], to: 'preRespond' },
          { name: 'didConvict', from: '*', to: 'convicted' },
          { name: 'didDecide', from: 'convicted', to: 'decided' },
        ],
        methods: {
          onEnterPreRespond: async (tsn) => {
            // wait for the other person to respond
            await waitForEvent(api.scryptVerifier, 'NewResponse', { filter: { sessionId } })
            // then execute query transition
            await tsn.fsm.query()
          },

          onBeforeQuery: async (tsn) => {
            cmd.log('Syncing Session State...')
            session = await api.getSession(claim.id)
            // const results = await api.getResult(session.input, session.medStep)

            await api.query(claim.id, step)
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
