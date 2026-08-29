// Async UI state shared by App (profile) and Recommendations.
export type Loadable<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }
