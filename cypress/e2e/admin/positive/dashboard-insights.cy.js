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

describe('Dashboard insights (owner)', { tags: ['@smoke'] }, () => {
  beforeEach(() => {
    cy.loginAdmin('owner');
  });

  it('shows insight tiles with a drill-down table for bookings this week', () => {
    const clientName = `Insights Client ${Date.now()}`;

    apiRequest('GET', '/services').then((servicesRes) => {
      const serviceId = servicesRes.body[0].id;

      apiRequest('POST', '/clients', {
        Name: clientName,
        Email: null,
        Phone: null,
        Notes: null,
        IsActive: true,
        Tags: [],
      }).then((clientRes) => {
        const clientId = clientRes.body.id;
        const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

        apiRequest('POST', '/schedule/sessions', {
          serviceId,
          resourceId: null,
          primaryStaffMembershipId: null,
          startsAt,
          endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
          capacityOverride: 0,
          isPublished: true,
          recurrenceRule: null,
          seriesId: null,
        }).then((sessionRes) => {
          apiRequest('POST', '/bookings', {
            scheduledSessionId: sessionRes.body.id,
            clientId,
            resourceSpotId: null,
          }).its('status').should('eq', 201);

          cy.visitAdmin('/');
          cy.get('[data-cy="insights-tiles"]').should('be.visible');

          cy.get('[data-cy="insight-tile-bookings"]').click();
          cy.get('[data-cy="drilldown-bookings"]').should('be.visible').and('contain.text', clientName);

          // Clicking again collapses it.
          cy.get('[data-cy="insight-tile-bookings"]').click();
          cy.get('[data-cy="drilldown-bookings"]').should('not.exist');
        });
      });
    });
  });

  it('shows a pass sale in the pass-revenue drill-down', () => {
    const passName = `Insights Pass ${Date.now()}`;
    const clientName = `Insights Buyer ${Date.now()}`;

    apiRequest('POST', '/pass-types', {
      Name: passName,
      SessionCount: 5,
      ValidityDays: 30,
      Price: 42,
      IsActive: true,
    }).then((passTypeRes) => {
      apiRequest('POST', '/clients', {
        Name: clientName,
        Email: null,
        Phone: null,
        Notes: null,
        IsActive: true,
        Tags: [],
      }).then((clientRes) => {
        apiRequest('POST', `/clients/${clientRes.body.id}/passes`, {
          PassTypeId: passTypeRes.body.id,
        }).its('status').should('eq', 201);

        cy.visitAdmin('/');
        cy.get('[data-cy="insight-tile-pass-revenue"]').click();
        cy.get('[data-cy="drilldown-pass-sales"]').should('be.visible')
          .and('contain.text', passName)
          .and('contain.text', clientName);
      });
    });
  });
});

describe('Dashboard insights — negative cases', { tags: ['@smoke'] }, () => {
  it('does not show insight tiles to a staff account (Owner-only)', () => {
    cy.loginAdmin('staff');
    cy.get('[data-cy="insights-tiles"]').should('not.exist');
  });
});
