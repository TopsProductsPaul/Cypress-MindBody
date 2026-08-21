describe('Clients CRUD (owner)', { tags: ['@smoke'] }, () => {
  const runId = Date.now();
  const clientName = `Alex Rivera ${runId}`;
  const updatedName = `${clientName} (Updated)`;

  beforeEach(() => {
    cy.loginAdmin('owner');
  });

  it('creates a client via the nav + form, shows tags and visit count in the list', () => {
    cy.get('[data-cy="nav-clients"]').click();
    cy.location('pathname').should('eq', '/clients');

    cy.get('[data-cy="clients-new-link"]').click();
    cy.location('pathname').should('eq', '/clients/new');

    cy.get('[data-cy="client-name-input"]').type(clientName);
    cy.get('[data-cy="client-email-input"]').type(`alex.${runId}@example.com`);
    cy.get('[data-cy="client-phone-input"]').type('(555) 123-0001');
    cy.get('[data-cy="client-notes-input"]').type('Prefers morning classes');
    cy.get('[data-cy="client-tags-input"]').type('yoga, beginner');
    cy.get('[data-cy="client-active-input"]').check();
    cy.get('[data-cy="client-save-button"]').click();

    cy.location('pathname').should('eq', '/clients');
    cy.get('[data-cy="clients-table"]').should('contain.text', clientName);
    cy.contains('[data-cy="clients-row"]', clientName).within(() => {
      cy.get('td').eq(3).should('contain.text', 'yoga');
      cy.get('td').eq(4).should('have.text', '0'); // visit count
    });
  });

  it('edits the client, adds a visit, and can no longer hard-delete it', () => {
    cy.visitAdmin('/clients');
    cy.contains('[data-cy="clients-row"]', clientName).find('[data-cy="clients-edit-link"]').click();

    cy.get('[data-cy="client-name-input"]').should('have.value', clientName);
    cy.get('[data-cy="client-name-input"]').clear().type(updatedName);
    cy.get('[data-cy="client-save-button"]').click();

    cy.location('pathname').should('eq', '/clients');
    cy.contains('[data-cy="clients-row"]', updatedName).should('exist');

    // Re-open to add a visit
    cy.contains('[data-cy="clients-row"]', updatedName).find('[data-cy="clients-edit-link"]').click();

    // Add a manual visit
    cy.get('[data-cy="client-visit-at-input"]').invoke('val', '2026-08-17T10:00').trigger('change');
    cy.get('[data-cy="client-visit-notes-input"]').type('Intro session');
    cy.get('[data-cy="client-add-visit-button"]').click();

    // Visit should appear in the table on the form
    cy.get('table').should('contain.text', 'Intro session');

    // Save and go back to list
    cy.get('[data-cy="client-save-button"]').click();
    cy.location('pathname').should('eq', '/clients');

    // A client with visit history can no longer be hard-deleted (silently cascading away their
    // history was a real bug -- the backend now blocks it and the form surfaces why).
    cy.contains('[data-cy="clients-row"]', updatedName).find('[data-cy="clients-edit-link"]').click();
    cy.get('[data-cy="client-delete-button"]').click();
    cy.get('[data-cy="client-delete-confirm-button"]').click();

    cy.get('[data-cy="client-form-error"]').should('be.visible').and('contain.text', 'inactive');
    cy.location('pathname').should('include', '/clients/');

    cy.visitAdmin('/clients');
    cy.get('[data-cy="clients-table"]').should('contain.text', updatedName);
  });

  it('deletes a client with no booking/pass/visit history', () => {
    const freshName = `Delete Me ${Date.now()}`;

    cy.visitAdmin('/clients/new');
    cy.get('[data-cy="client-name-input"]').type(freshName);
    cy.get('[data-cy="client-save-button"]').click();
    cy.location('pathname').should('eq', '/clients');

    cy.contains('[data-cy="clients-row"]', freshName).find('[data-cy="clients-edit-link"]').click();
    cy.get('[data-cy="client-delete-button"]').click();
    cy.get('[data-cy="client-delete-confirm-button"]').click();

    cy.location('pathname').should('eq', '/clients');
    cy.get('[data-cy="clients-table"]').should('not.contain.text', freshName);
  });
});

describe('Clients — negative cases', { tags: ['@smoke'] }, () => {
  it('does not show the Clients nav link to a staff account (Owner-only)', () => {
    cy.loginAdmin('staff');
    cy.get('[data-cy="nav-clients"]').should('not.exist');
  });
});
