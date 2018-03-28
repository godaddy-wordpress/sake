const async = require('async')
const Trello = require('node-trello')
const querystring = require('querystring')

module.exports = (gulp, plugins, sake) => {
  gulp.task('trello:update_wc_card', (done) => {
    // sanity check
    if (sake.config.deploy.type !== 'wc') {
      sake.throwError('Invalid deploy type for plugin: ' + sake.config.deploy.type)
    }

    // sanity check
    if (!sake.config.trelloBoard) {
      sake.throwError('No Trello board configured')
    }

    if (!sake.options.release_url) {
      sake.throwError('No release url set. Set a release url with --release_url option')
    }

    sake.validateEnvironmentVariables(['TRELLO_API_KEY', 'TRELLO_API_TOKEN'])

    let trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_API_TOKEN)

    async.waterfall([
      // get the trello board (so we get it's internal ID, as Trello won't work with the external/short id)
      (cb) => {
        trello.get('/1/boards/' + sake.config.trelloBoard, (err, board) => {
          if (err) sake.throwError(err)

          if (!board) {
            sake.throwError(`Trello board ${sake.config.trelloBoard} not found`)
          }

          cb(null, board)
        })
      },

      // get the lists for our board
      (board, cb) => {
        trello.get(`/1/boards/${board.id}/lists`, (err, lists) => {
          if (err) sake.throwError(err)

          if (!lists) {
            sake.throwError(`No lists found for board ${sake.config.trelloBoard}`)
          }

          let list = lists.find((list) => list.name === 'Deploy Update')

          cb(null, board, list)
        })
      },

      // get the card for our plugin
      (board, list, cb) => {
        let query = querystring.stringify({
          query: sake.config.plugin.id,
          modelType: 'cards',
          idBoards: board.id,
          board_fields: 'name',
          cards_limit: 1
        })

        trello.get(`/1/search?${query}`, (err, data) => {
          if (err) sake.throwError(err)

          if (!data.cards || !data.cards.length) {
            sake.throwError(`No cards found for ${sake.config.plugin.id}`)
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
        trello.post(`/1/cards/${card.id}/actions/comments?text=${sake.options.release_url}`, cb)
      }
    ], (err) => {
      if (err) {
        sake.throwError('An error occurred while updating Trello card: ' + err.toString())
      }

      done()
    })
  })
}
