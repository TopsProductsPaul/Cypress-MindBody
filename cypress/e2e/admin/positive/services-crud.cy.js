describe('Services CRUD (owner)', { tags: ['@smoke'] }, () => {
  const serviceName = `Vinyasa Flow ${Date.now()}`;
  const updatedName = `${serviceName} (Level 2)`;

  beforeEach(() => {
    cy.loginAdmin('owner');
  });

  it('creates a service via the nav + form and shows it in the list', () => {
    cy.get('[data-cy="nav-services"]').click();
    cy.location('pathname').should('eq', '/services');

    cy.get('[data-cy="services-new-link"]').click();
    cy.location('pathname').should('eq', '/services/new');

    cy.get('[data-cy="service-name-input"]').type(serviceName);
    cy.get('[data-cy="service-type-input"]').select('Class');
    cy.get('[data-cy="service-duration-input"]').clear().type('45');
    cy.get('[data-cy="service-capacity-input"]').clear().type('12');
    cy.get('[data-cy="service-credit-cost-input"]').clear().type('1');
    cy.get('[data-cy="service-save-button"]').click();

    cy.location('pathname').should('eq', '/services');
    cy.get('[data-cy="services-table"]').should('contain.text', serviceName);
    cy.contains('[data-cy="services-row"]', serviceName).within(() => {
      cy.get('td').eq(2).should('have.text', '45 min');
      cy.get('td').eq(3).should('have.text', '12');
    });
  });

  it('edits and deletes the service it just created', () => {
    cy.visitAdmin('/services');
    cy.contains('[data-cy="services-row"]', serviceName).find('[data-cy="services-edit-link"]').click();

    cy.get('[data-cy="service-name-input"]').should('have.value', serviceName);
    cy.get('[data-cy="service-duration-input"]').should('have.value', '45');

    cy.get('[data-cy="service-name-input"]').clear().type(updatedName);
    cy.get('[data-cy="service-capacity-input"]').clear().type('20');
    cy.get('[data-cy="service-save-button"]').click();

    cy.location('pathname').should('eq', '/services');
    cy.contains('[data-cy="services-row"]', updatedName).within(() => {
      cy.get('td').eq(3).should('have.text', '20');
    });

    cy.contains('[data-cy="services-row"]', updatedName).find('[data-cy="services-edit-link"]').click();
    cy.get('[data-cy="service-delete-button"]').click();

    cy.location('pathname').should('eq', '/services');
    cy.get('[data-cy="services-table"]').should('not.contain.text', updatedName);
  });
});

  it("won't hard-delete a service that has a scheduled session", () => {
    const sessionServiceName = `Session-Backed Service ${Date.now()}`;

    cy.visitAdmin('/services/new');
    cy.get('[data-cy="service-name-input"]').type(sessionServiceName);
    cy.get('[data-cy="service-type-input"]').select('Class');
    cy.get('[data-cy="service-duration-input"]').clear().type('45');
    cy.get('[data-cy="service-capacity-input"]').clear().type('10');
    cy.get('[data-cy="service-credit-cost-input"]').clear().type('1');
    cy.get('[data-cy="service-save-button"]').click();
    cy.location('pathname').should('eq', '/services');

    cy.window().then((win) => {
      const token = win.localStorage.getItem('minbody.auth.token');
      cy.contains('[data-cy="services-row"]', sessionServiceName)
        .find('[data-cy="services-edit-link"]').invoke('attr', 'href').then((href) => {
          const serviceId = href.split('/').pop();
          cy.request({
            method: 'POST',
            url: `${Cypress.env('apiBaseUrl')}/schedule/sessions`,
            headers: { Authorization: `Bearer ${token}` },
            body: {
              serviceId,
              resourceId: null,
              primaryStaffMembershipId: null,
              startsAt: '2030-01-20T10:00:00.000Z',
              endsAt: '2030-01-20T11:00:00.000Z',
              capacityOverride: 5,
              isPublished: true,
              recurrenceRule: null,
              seriesId: null,
            },
          }).its('status').should('eq', 201);
        });
    });

    cy.contains('[data-cy="services-row"]', sessionServiceName).find('[data-cy="services-edit-link"]').click();
    cy.get('[data-cy="service-delete-button"]').click();

    cy.get('[data-cy="service-form-error"]').should('be.visible').and('contain.text', 'inactive');
    cy.visitAdmin('/services');
    cy.get('[data-cy="services-table"]').should('contain.text', sessionServiceName);
  });
});

describe('Services — negative cases', { tags: ['@smoke'] }, () => {
  it('does not show the Services nav link to a staff account (Owner-only)', () => {
    cy.loginAdmin('staff');

    cy.get('[data-cy="nav-services"]').should('not.exist');
  });
});
