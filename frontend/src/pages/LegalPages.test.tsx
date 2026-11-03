import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { TermsOfUse } from './TermsOfUse';
import { PrivacyPolicy } from './PrivacyPolicy';
import { TERMS_LAST_UPDATED, TERMS_SECTIONS } from '../legal/termsSections';
import { PRIVACY_LAST_UPDATED } from '../legal/PrivacyPolicyContent';

function renderPage(ui: React.ReactElement) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>,
  );
}

describe('páginas legais (painel e landing)', () => {
  it('termos: todas as seções, data e volta ao login por padrão', () => {
    renderPage(<TermsOfUse />);
    for (const section of TERMS_SECTIONS) {
      expect(screen.getByText(section.title)).toBeInTheDocument();
    }
    expect(screen.getAllByText(new RegExp(TERMS_LAST_UPDATED)).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Voltar ao login/ })).toHaveAttribute('href', '/login');
  });

  it('termos na landing: destino e rótulo do botão de voltar vêm por props', () => {
    renderPage(<TermsOfUse backTo="/" backLabel="Voltar ao site" />);
    expect(screen.getByRole('link', { name: /Voltar ao site/ })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: /Voltar ao login/ })).not.toBeInTheDocument();
  });

  it('privacidade: conteúdo, data, link para os termos e botão de voltar configurável', () => {
    const { unmount } = renderPage(<PrivacyPolicy />);
    expect(screen.getAllByText(new RegExp(PRIVACY_LAST_UPDATED)).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Voltar ao login/ })).toHaveAttribute('href', '/login');
    expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === '/termos')).toBe(true);
    unmount();

    renderPage(<PrivacyPolicy backTo="/" backLabel="Voltar ao site" />);
    expect(screen.getByRole('link', { name: /Voltar ao site/ })).toHaveAttribute('href', '/');
  });
});
