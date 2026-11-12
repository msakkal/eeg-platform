import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '../src/i18n/i18n'
import App from '../src/App'

const loading = vi.hoisted(() => {
  let resolve
  const promise = new Promise((accept) => {
    resolve = accept
  })
  return { promise, resolve, preload: vi.fn() }
})

vi.mock('../src/routeLoaders', () => {
  const paths = [
    '/',
    '/concepts',
    '/montages',
    '/atlas',
    '/waveforms',
    '/findings',
    '/sandbox',
    '/quiz',
    '/artifacts',
    '/reading-algorithm',
    '/report-builder',
  ]
  const pageLoaders = Object.fromEntries(
    paths.map((path) => [path, () => Promise.resolve({ default: () => null })]),
  )
  pageLoaders['/'] = () => Promise.resolve({ default: () => <h1>Home section</h1> })
  pageLoaders['/sandbox'] = () => loading.promise
  return { pageLoaders, preloadRoute: loading.preload }
})
vi.mock('../src/components/ui/LoadingScreen', () => ({
  default: () => <div>Loading whole page</div>,
}))

afterEach(cleanup)

it('prefetches on intent and retains the current section while the next route loads', async () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  )
  const home = await screen.findByRole('heading', { name: 'Home section' })
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  const sandbox = within(nav).getByRole('link', { name: 'Sandbox' })
  fireEvent.pointerEnter(sandbox)
  expect(loading.preload).toHaveBeenCalledWith('/sandbox')
  fireEvent.click(sandbox)
  expect(home).toBeVisible()
  expect(screen.queryByText('Loading whole page')).not.toBeInTheDocument()
  await act(async () => loading.resolve({ default: () => <h1>Sandbox section</h1> }))
  expect(await screen.findByRole('heading', { name: 'Sandbox section' })).toBeVisible()
})
