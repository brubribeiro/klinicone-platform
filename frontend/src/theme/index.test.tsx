import { Button, Chip, CssBaseline, Table, TableBody, TableCell, TableHead, TableRow, TextField, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createAppTheme } from './index';

describe('createAppTheme', () => {
  it('cria tema claro com superfície branca e texto escuro', () => {
    const t = createAppTheme('light');
    expect(t.palette.mode).toBe('light');
    expect(t.palette.primary.main).toBe('#15998B');
    expect(t.palette.background.paper).toBe('#FFFFFF');
    expect(t.palette.background.default).toBe('#EAF1EF');
    expect(t.palette.text.primary).toBe('#0F1C1A');
  });

  it('cria tema escuro com fundos escuros e escala de cinza invertida', () => {
    const light = createAppTheme('light');
    const dark = createAppTheme('dark');
    expect(dark.palette.mode).toBe('dark');
    expect(dark.palette.background.default).toBe('#0A1413');
    expect(dark.palette.background.paper).toBe('#111F1D');
    expect(dark.palette.grey[50]).not.toBe(light.palette.grey[50]);
    expect(dark.palette.info.main).toBe('#4C9BE0');
  });

  it('mantém o mesmo verde primário nos dois modos e usa pt-BR', () => {
    expect(createAppTheme('dark').palette.primary.main).toBe(createAppTheme('light').palette.primary.main);
    expect(createAppTheme('light').components?.MuiTablePagination?.defaultProps).toBeDefined();
  });

  it('define overrides de componentes nos dois modos', () => {
    for (const mode of ['light', 'dark'] as const) {
      const c = createAppTheme(mode).components!;
      for (const key of ['MuiButton', 'MuiTableHead', 'MuiTableRow', 'MuiTableCell'] as const) {
        expect(c[key]).toBeDefined();
      }
    }
  });

  it('aplica os estilos aos componentes ao renderizar nos dois modos', () => {
    for (const mode of ['light', 'dark'] as const) {
      const { unmount } = render(
        <ThemeProvider theme={createAppTheme(mode)}>
          <CssBaseline />
          <Button variant="contained">primario-{mode}</Button>
          <Button variant="outlined" color="error">outline-{mode}</Button>
          <Button variant="text" size="small">texto-{mode}</Button>
          <Chip label={`chip-${mode}`} color="success" />
          <Chip label={`chip-o-${mode}`} variant="outlined" />
          <TextField label={`campo-${mode}`} size="small" />
          <TextField select label={`sel-${mode}`} value="a" SelectProps={{ native: true }}>
            <option value="a">A</option>
          </TextField>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>cab-{mode}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>cel-{mode}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ThemeProvider>,
      );
      expect(screen.getByRole('button', { name: `primario-${mode}` })).toBeInTheDocument();
      expect(screen.getByText(`cab-${mode}`)).toBeInTheDocument();
      unmount();
    }
  });
});
