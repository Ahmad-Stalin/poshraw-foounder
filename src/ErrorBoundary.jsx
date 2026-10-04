import { Component } from 'react'
import { reportClientError } from './monitoring.js'

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    reportClientError('react_boundary')
  }

  render() {
    if (this.state.failed) {
      return (
        <main role="alert">
          <h1>Something went wrong</h1>
          <p>Please refresh the page and try again.</p>
          <button type="button" onClick={() => window.location.reload()}>Refresh page</button>
        </main>
      )
    }
    return this.props.children
  }
}
