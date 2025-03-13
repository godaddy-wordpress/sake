import dottie from 'dottie';
import sake from '../lib/sake.js'

export const config = (done) => {
  // pass --property=deploy.production to only see sake.config values for that property
  if (sake.options.property) {
    console.log(dottie.get(sake.config, sake.options.property))
  } else {
    console.log(sake.config)
  }

  done()
}
