const async = require('async')
const Trello = require('node-trello')
const querystring = require('querystring')

module.exports = (gulp, config, plugins, options) => {
  const util = require('../lib/utilities')(config, options)

  gulp.task('trello:update_wc_card', (done) => {
    // sanity check
    if (config.deploy.type !== 'wc') {
      let err = new Error('Invalid deploy type for plugin: ' + config.deploy.type)
      err.showStack = false
      throw err
    }

    // sanity check
    if (!config.trelloBoard) {
      let err = new Error('No Trello board configured')
      err.showStack = false
      throw err
    }

    util.validateEnvironmentVariables(['TRELLO_API_KEY', 'TRELLO_API_TOKEN'])

    let trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_API_TOKEN)

    async.waterfall([
      // get the trello board (so we get it's internal ID, as Trello won't work with the external/short id)
      (cb) => {
        trello.get('/1/boards/' + config.trelloBoard, (err, board) => {
          if (err) return done(err)

          if (!board) {
            let err = new Error(`Trello board ${config.trelloBoard} not found`)
            err.showStack = false
            throw err
          }

          cb(null, board)
        })
      },

      // get the lists for our board
      (board, cb) => {
        trello.get(`/1/boards/${board.id}/lists`, (err, lists) => {
          if (err) return done(err)

          if (!lists) {
            let err = new Error(`No lists found for board ${config.trelloBoard}`)
            err.showStack = false
            throw err
          }

          let list = lists.find((list) => list.name === 'Deploy Update')

          cb(null, board, list)
        })
      },

      // get the card for our plugin
      (board, list, cb) => {
        let query = querystring.stringify({
          query: config.plugin.id,
          modelType: 'cards',
          idBoards: board.id,
          board_fields: 'name',
          cards_limit: 1
        })

        trello.get(`/1/search?${query}`, (err, data) => {
          if (err) return done(err)

          if (!data.cards || !data.cards.length) {
            let err = new Error(`No cards found for ${config.plugin.id}`)
            err.showStack = false
            throw err
          }

          let card = data.cards.pop()

          cb(null, list, card)
        })
      },

      // move card to Deploy Update list
      (list, card, cb) => {
        trello.put(`/1/cards/${card.id}?idList=${list.id}`, cb)
      },

      // add release url as a comment
      (card, cb) => {
        trello.post(`/1/cards/${card.id}/actions/comments?text=${options.release_url}`, cb)
      }
    ], (err) => {
      if (err) {
        let err = new Error('An error occurred while updating Trello card: ' + err.toString())
        err.showStack = false
        throw err
      }

      done()
    })
  })
}
