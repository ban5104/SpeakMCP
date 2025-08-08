import { vi } from 'vitest'

/**
 * Create a proper mock for require.resolve with all required properties
 */
export function createMockRequireResolve(mockImpl?: (request: string) => string) {
  const resolveFn = mockImpl || vi.fn((request: string) => `/mocked/path/${request}`)
  // Add the paths property required by RequireResolve interface
  ;(resolveFn as any).paths = vi.fn((request: string) => [`/mocked/paths/${request}`])
  return resolveFn
}

/**
 * Create a proper mock for require with all required properties
 */
export function createMockRequire(mockImpl?: (id: string) => any) {
  const requireFn = mockImpl || vi.fn((id: string) => ({ default: `mocked-${id}` }))
  
  // Add all required properties for the Require interface
  ;(requireFn as any).cache = {}
  ;(requireFn as any).extensions = {}
  ;(requireFn as any).main = { filename: '/mocked/main.js', exports: {} }
  ;(requireFn as any).resolve = createMockRequireResolve()
  
  return requireFn
}