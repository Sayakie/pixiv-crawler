import App from './App'

process.on('unhandledRejection', reason => console.warn(`WARNING: Unhandled promise rejection.  Reason: ${reason}`))

App.getInstance()
  .start()
  .catch(console.error)
