import { describe, expect, it } from 'vitest';
import { queryAllCards } from './dom-selectors';
import { getCanonicalLotUrl } from './lot-url';

describe('feed card support', () => {
  it('finds cards wrapped by feed links with view_lot', () => {
    document.body.innerHTML = `
      <main>
        <a href="https://www.catawiki.com/es/x/726162-coleccion?view_lot=102204088">
          <article>
            <figure></figure>
            <p>Certificado por ALGT</p>
            <p>Puja actual</p>
            <div>410 €</div>
          </article>
        </a>
      </main>
    `;

    const cards = queryAllCards();
    expect(cards).toHaveLength(1);
    expect(getCanonicalLotUrl((cards[0].closest('a') as HTMLAnchorElement).href))
      .toBe('https://www.catawiki.com/es/l/102204088');
  });
});
