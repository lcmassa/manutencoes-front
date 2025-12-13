import React, { useEffect } from 'react'

type Props = {
  token: string | null
}

export const TokenExpiryToast: React.FC<Props> = ({ token }) => {
  useEffect(() => {
    // No-op simple helper. Could parse exp and warn when nearing expiry in the future.
  }, [token])

  return null
}


