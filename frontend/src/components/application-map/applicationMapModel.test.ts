import { describe, it, expect } from 'vitest';

import {
  FACE_VIEWS,
  MAP_PRODUCTS,
  formatProductTotal,
  formatQty,
  guessProducts,
  parseQty,
  pointView,
  productDef,
} from './applicationMapModel';

describe('applicationMapModel', () => {
  it('productDef resolve o produto pelo id e devolve undefined sem id', () => {
    expect(productDef('toxin')?.label).toBe('Toxina Botulínica');
    expect(productDef()).toBeUndefined();
  });

  it('pointView assume a frente do rosto quando o ponto não tem view', () => {
    expect(pointView({ x: 1, y: 2 })).toBe('front');
    expect(pointView({ x: 1, y: 2, view: 'body' })).toBe('body');
    expect(FACE_VIEWS).toEqual(['left', 'front', 'right']);
  });

  it('parseQty aceita vírgula decimal e rejeita texto, negativos e vazio', () => {
    expect(parseQty('2,5')).toBe(2.5);
    expect(parseQty('10')).toBe(10);
    expect(parseQty('0')).toBe(0);
    expect(parseQty('')).toBeUndefined();
    expect(parseQty('abc')).toBeUndefined();
    expect(parseQty('-3')).toBeUndefined();
  });

  it('formatQty usa vírgula e no máximo 2 casas', () => {
    expect(formatQty(2.5)).toBe('2,5');
    expect(formatQty(1.234)).toBe('1,23');
    expect(formatQty(4)).toBe('4');
  });

  it('formatProductTotal soma só o produto pedido, com a unidade dele', () => {
    const toxin = MAP_PRODUCTS.find((p) => p.id === 'toxin')!;
    const filler = MAP_PRODUCTS.find((p) => p.id === 'filler')!;
    const points = [
      { x: 1, y: 1, product: 'toxin' as const, qty: 4 },
      { x: 2, y: 2, product: 'toxin' as const, qty: 2.5 },
      { x: 3, y: 3, product: 'filler' as const, qty: 0.5 },
      { x: 4, y: 4, product: 'toxin' as const },
    ];
    expect(formatProductTotal(toxin, points)).toBe('6,5 U');
    expect(formatProductTotal(filler, points)).toBe('0,5 ml');
    expect(formatProductTotal(filler, [])).toBe('0,0 ml');
  });

  it('guessProducts deduz produtos dos nomes, ignorando acento e caixa, na ordem do catálogo', () => {
    expect(guessProducts(['Preenchimento labial', 'BOTOX Testa'])).toEqual(['toxin', 'filler']);
    expect(guessProducts(['Bioestimulador de colágeno', 'Skin Booster', 'Bioremodelador'])).toEqual([
      'biostimulator',
      'bioremodeler',
      'skinbooster',
    ]);
    expect(guessProducts(['Limpeza de pele'])).toEqual([]);
    expect(guessProducts([])).toEqual([]);
  });
});
