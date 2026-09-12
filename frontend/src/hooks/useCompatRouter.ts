import { useNavigate as useTanNavigate } from '@tanstack/react-router'

export function useSearchParams() {
  const navigate = useTanNavigate()
  const searchParams = new URLSearchParams(window.location.search)
  const setSearchParams = (next: any) => {
    let nextParams: URLSearchParams
    if (next instanceof URLSearchParams) nextParams = next
    else if (typeof next === 'function') nextParams = next(searchParams)
    else nextParams = new URLSearchParams(next as Record<string, string>)
    const obj = Object.fromEntries(nextParams.entries())
    // @ts-ignore
    navigate({ to: '.', search: obj })
  }
  return [searchParams, setSearchParams] as const
}

export function useNavigate() {
  const tanNavigate = useTanNavigate()
  return (to: any) => {
    if (typeof to === 'string') return tanNavigate({ to } as any)
    return tanNavigate(to as any)
  }
}
