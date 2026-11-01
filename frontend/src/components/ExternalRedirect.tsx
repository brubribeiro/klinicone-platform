import { useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';

/** Redirecionamento para outra origem ou app (ex.: console admin em outro deploy). */
export function ExternalRedirect({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
      <CircularProgress />
    </Box>
  );
}
