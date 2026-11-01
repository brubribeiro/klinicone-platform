import { renderMessageTemplate, whatsappMeUrl } from './whatsapp.util';

describe('whatsapp.util', () => {
  it('renderMessageTemplate resolves {nome} and legacy keys', () => {
    const out = renderMessageTemplate('Oi {nome}, {procedimento} em {data}', {
      paciente_nome: 'Ana',
      procedimento: 'Peeling',
      data: '01/11/2026',
    });
    expect(out).toBe('Oi Ana, Peeling em 01/11/2026');
  });

  it('whatsappMeUrl adds country code for BR mobiles', () => {
    const url = whatsappMeUrl('(11) 98888-7777', 'Olá');
    expect(url).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=/);
  });

  it('whatsappMeUrl returns null without enough digits', () => {
    expect(whatsappMeUrl('123', 'x')).toBeNull();
  });
});
