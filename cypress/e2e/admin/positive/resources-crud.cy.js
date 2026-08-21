const apiRequest = (method, path, body) => (
  cy.window().then((win) => {
    const token = win.localStorage.getItem('minbody.auth.token');
    return cy.request({
      method,
      url: `${Cypress.env('apiBaseUrl')}${path}`,
      headers: { Authorization: `Bearer ${token}` },
      body,
      failOnStatusCode: false,
    });
  })
);

describe('Resources CRUD (owner)', { tags: ['@smoke'] }, () => {
  const resourceName = `Test Reformer Room ${Date.now()}`;
  const updatedName = `${resourceName} (Renamed)`;

  beforeEach(() => {
    cy.loginAdmin('owner');
  });

  it('creates a resource via the nav + form and shows it in the list', () => {
    cy.get('[data-cy="nav-resources"]').click();
    cy.location('pathname').should('eq', '/resources');

    cy.get('[data-cy="resources-new-link"]').click();
    cy.location('pathname').should('eq', '/resources/new');

    cy.get('[data-cy="resource-name-input"]').type(resourceName);
    cy.get('[data-cy="resource-description-input"]').type('A room full of reformers');
    cy.get('[data-cy="resource-save-button"]').click();

    cy.location('pathname').should('eq', '/resources');
    cy.get('[data-cy="resources-table"]').should('contain.text', resourceName);
  });

  it('edits a resource, adds spots, then rejects a duplicate position', () => {
    cy.visitAdmin('/resources');
    cy.contains('[data-cy="resources-row"]', resourceName).find('[data-cy="resources-edit-link"]').click();

    cy.get('[data-cy="resource-name-input"]').should('have.value', resourceName);
    cy.get('[data-cy="resource-name-input"]').clear().type(updatedName);
    cy.get('[data-cy="resource-save-button"]').click();

    cy.location('pathname').should('eq', '/resources');
    cy.contains('[data-cy="resources-row"]', updatedName).should('exist');

    cy.contains('[data-cy="resources-row"]', updatedName).find('[data-cy="resources-edit-link"]').click();

    cy.get('[data-cy="resource-spots-empty"]').should('be.visible');
    cy.get('[data-cy="resource-spot-position-input"]').clear().type('1');
    cy.get('[data-cy="resource-spot-label-input"]').type('Reformer 1');
    cy.get('[data-cy="resource-add-spot-button"]').click();

    cy.get('[data-cy="resource-spots-table"]').should('contain.text', 'Reformer 1');
    cy.get('[data-cy="resource-spots-row"]').should('have.length', 1);

    // Duplicate position rejected
    cy.get('[data-cy="resource-spot-position-input"]').clear().type('1');
    cy.get('[data-cy="resource-spot-label-input"]').type('Reformer 1 Duplicate');
    cy.get('[data-cy="resource-add-spot-button"]').click();
    cy.get('[data-cy="resource-spot-error"]').should('be.visible');
    cy.get('[data-cy="resource-spots-row"]').should('have.length', 1);

    // Remove the spot
    cy.get('[data-cy="resource-spot-remove-button"]').click();
    cy.get('[data-cy="resource-spots-empty"]').should('be.visible');
  });

  it("won't hard-delete a resource that has a scheduled session", () => {
    const sessionResourceName = `Session-Backed Resource ${Date.now()}`;

    cy.visitAdmin('/resources/new');
    cy.get('[data-cy="resource-name-input"]').type(sessionResourceName);
    cy.get('[data-cy="resource-save-button"]').click();
    cy.location('pathname').should('eq', '/resources');

    cy.window().then((win) => {
      const token = win.localStorage.getItem('minbody.auth.token');
      cy.contains('[data-cy="resources-row"]', sessionResourceName)
        .find('[data-cy="resources-edit-link"]').invoke('attr', 'href').then((href) => {
          const resourceId = href.split('/').pop();

          cy.request({
            method: 'GET',
            url: `${Cypress.env('apiBaseUrl')}/services`,
            headers: { Authorization: `Bearer ${token}` },
          }).then((servicesRes) => {
            const serviceId = servicesRes.body[0].id;

            cy.request({
              method: 'POST',
              url: `${Cypress.env('apiBaseUrl')}/schedule/sessions`,
              headers: { Authorization: `Bearer ${token}` },
              body: {
                serviceId,
                resourceId,
                primaryStaffMembershipId: null,
                startsAt: '2030-01-21T10:00:00.000Z',
                endsAt: '2030-01-21T11:00:00.000Z',
                capacityOverride: 5,
                isPublished: true,
                recurrenceRule: null,
                seriesId: null,
              },
            }).its('status').should('eq', 201);
          });
        });
    });

    cy.contains('[data-cy="resources-row"]', sessionResourceName).find('[data-cy="resources-edit-link"]').click();
    cy.get('[data-cy="resource-delete-button"]').click();
    cy.get('[data-cy="resource-delete-confirm-button"]').click();

    cy.get('[data-cy="resource-form-error"]').should('be.visible');
    cy.visitAdmin('/resources');
    cy.get('[data-cy="resources-table"]').should('contain.text', sessionResourceName);
  });

  it('deletes a resource with no scheduled sessions', () => {
    const freshName = `Delete Me Resource ${Date.now()}`;

    cy.visitAdmin('/resources/new');
    cy.get('[data-cy="resource-name-input"]').type(freshName);
    cy.get('[data-cy="resource-save-button"]').click();
    cy.location('pathname').should('eq', '/resources');

    cy.contains('[data-cy="resources-row"]', freshName).find('[data-cy="resources-edit-link"]').click();
    cy.get('[data-cy="resource-delete-button"]').click();
    cy.get('[data-cy="resource-delete-confirm-button"]').click();

    cy.location('pathname').should('eq', '/resources');
    cy.get('[data-cy="resources-table"]').should('not.contain.text', freshName);
  });
});

describe('Resources — negative cases', { tags: ['@smoke'] }, () => {
  it('does not show the Resources nav link to a staff account (Owner-only)', () => {
    cy.loginAdmin('staff');
    cy.get('[data-cy="nav-resources"]').should('not.exist');
  });

  it('rejects staff writes at the API boundary', () => {
    cy.loginAdmin('staff');
    apiRequest('POST', '/resources', { name: 'Nope', description: null }).then((res) => {
      expect(res.status).to.eq(403);
    });
  });
});
