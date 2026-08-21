describe('Passes CRUD (owner)', { tags: ['@smoke'] }, () => {
  const passName = `10 Class Pack ${Date.now()}`;
  const updatedName = `${passName} (Sale)`;

  beforeEach(() => {
    cy.loginAdmin('owner');
  });

  it('creates a pass type via the nav + form and shows it in the list', () => {
    cy.get('[data-cy="nav-pass-types"]').click();
    cy.location('pathname').should('eq', '/pass-types');

    cy.get('[data-cy="pass-types-new-link"]').click();
    cy.location('pathname').should('eq', '/pass-types/new');

    cy.get('[data-cy="pass-type-name-input"]').type(passName);
    cy.get('[data-cy="pass-type-session-count-input"]').clear().type('10');
    cy.get('[data-cy="pass-type-validity-days-input"]').clear().type('90');
    cy.get('[data-cy="pass-type-price-input"]').clear().type('150');
    cy.get('[data-cy="pass-type-save-button"]').click();

    cy.location('pathname').should('eq', '/pass-types');
    cy.get('[data-cy="pass-types-table"]').should('contain.text', passName);
    cy.contains('[data-cy="pass-types-row"]', passName).within(() => {
      cy.get('td').eq(1).should('have.text', '10');
    });
  });

  it('creates an unlimited, never-expiring pass type', () => {
    const unlimitedName = `Unlimited Monthly ${Date.now()}`;

    cy.get('[data-cy="nav-pass-types"]').click();
    cy.get('[data-cy="pass-types-new-link"]').click();

    cy.get('[data-cy="pass-type-name-input"]').type(unlimitedName);
    cy.get('[data-cy="pass-type-session-count-input"]').clear();
    cy.get('[data-cy="pass-type-validity-days-input"]').clear();
    cy.get('[data-cy="pass-type-price-input"]').clear().type('99');
    cy.get('[data-cy="pass-type-save-button"]').click();

    cy.contains('[data-cy="pass-types-row"]', unlimitedName).within(() => {
      cy.get('td').eq(1).should('have.text', 'Unlimited');
      cy.get('td').eq(2).should('have.text', 'Never expires');
    });
  });

  it('edits and deletes the pass type it just created', () => {
    cy.visitAdmin('/pass-types');
    cy.contains('[data-cy="pass-types-row"]', passName).find('[data-cy="pass-types-edit-link"]').click();

    cy.get('[data-cy="pass-type-name-input"]').should('have.value', passName);

    cy.get('[data-cy="pass-type-name-input"]').clear().type(updatedName);
    cy.get('[data-cy="pass-type-price-input"]').clear().type('175');
    cy.get('[data-cy="pass-type-save-button"]').click();

    cy.location('pathname').should('eq', '/pass-types');
    cy.contains('[data-cy="pass-types-row"]', updatedName).should('be.visible');

    cy.contains('[data-cy="pass-types-row"]', updatedName).find('[data-cy="pass-types-edit-link"]').click();
    cy.get('[data-cy="pass-type-delete-button"]').click();

    cy.location('pathname').should('eq', '/pass-types');
    cy.get('[data-cy="pass-types-table"]').should('not.contain.text', updatedName);
  });

  it('sells a pass to a client and shows it on the client\'s Passes section', () => {
    const clientName = `Pass Buyer ${Date.now()}`;
    const sellablePassName = `Sellable Pack ${Date.now()}`;

    // Create a fresh pass type to sell.
    cy.visitAdmin('/pass-types/new');
    cy.get('[data-cy="pass-type-name-input"]').type(sellablePassName);
    cy.get('[data-cy="pass-type-session-count-input"]').clear().type('5');
    cy.get('[data-cy="pass-type-validity-days-input"]').clear().type('60');
    cy.get('[data-cy="pass-type-price-input"]').clear().type('80');
    cy.get('[data-cy="pass-type-save-button"]').click();

    // Create a fresh client.
    cy.visitAdmin('/clients/new');
    cy.get('[data-cy="client-name-input"]').type(clientName);
    cy.get('[data-cy="client-save-button"]').click();
    cy.location('pathname').should('eq', '/clients');

    cy.contains('[data-cy="clients-row"]', clientName).find('[data-cy="clients-edit-link"]').click();

    cy.get('[data-cy="client-passes-empty"]').should('be.visible');
    cy.get('[data-cy="client-sell-pass-type-select"]').select(sellablePassName + ' ($80.00)');
    cy.get('[data-cy="client-sell-pass-button"]').click();

    cy.get('[data-cy="client-passes-table"]').should('be.visible');
    cy.contains('[data-cy="client-passes-row"]', sellablePassName).within(() => {
      cy.get('td').eq(1).should('have.text', '5 / 5');
      cy.get('td').eq(4).should('have.text', 'Active');
    });
  });
});

describe('Passes — negative cases', { tags: ['@smoke'] }, () => {
  it('does not show the Passes nav link to a staff account (Owner-only)', () => {
    cy.loginAdmin('staff');
    cy.get('[data-cy="nav-pass-types"]').should('not.exist');
  });
});
