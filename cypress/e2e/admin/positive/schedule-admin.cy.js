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

const getScenarioData = () => (
  apiRequest('GET', '/services').then((servicesResponse) => {
    expect(servicesResponse.status).to.eq(200);
    expect(servicesResponse.body).to.have.length.greaterThan(0);

    return apiRequest('GET', '/clients').then((clientsResponse) => {
      expect(clientsResponse.status).to.eq(200);
      expect(clientsResponse.body).to.have.length.greaterThan(1);

      return apiRequest('GET', '/schedule/resources').then((resourcesResponse) => {
        expect(resourcesResponse.status).to.eq(200);
        return {
          service: servicesResponse.body[0],
          clients: clientsResponse.body,
          resource: resourcesResponse.body.find((resource) => resource.name === 'Reformer Studio'),
        };
      });
    });
  })
);

const createSession = (serviceId, capacity, startsAt, resourceId = null) => (
  apiRequest('POST', '/schedule/sessions', {
    serviceId,
    resourceId,
    primaryStaffMembershipId: null,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
    capacityOverride: capacity,
    isPublished: true,
    recurrenceRule: null,
    seriesId: null,
  }).then((response) => {
    expect(response.status).to.eq(201);
    expect(response.body.id).to.be.a('string').and.not.be.empty;
    return response.body;
  })
);

const openSession = (sessionId) => {
  cy.visitAdmin('/schedule');
  cy.location('pathname').should('eq', '/schedule');
  cy.document().its('readyState').should('eq', 'complete');
  // The schedule defaults to a 14-day window (reduces the list to what's actually
  // decision-relevant); this spec's fixture sessions are deliberately far in the future for
  // test isolation, so clear the filter to bring them back into view.
  cy.get('[data-cy="schedule-filter-clear"]').click();
  cy.get(`[data-cy="schedule-row"][data-session-id="${sessionId}"]`)
    .find('[data-cy="schedule-view-button"]')
    .click();
  cy.get('[data-cy="schedule-detail"]').should('be.visible');
};

const selectOption = (selector, value) => {
  cy.get(selector).select(value);
  cy.get(selector).should('have.value', value);
};

describe('Schedule booking and waitlist workflows (owner)', { tags: ['@smoke'] }, () => {
  beforeEach(() => {
    cy.loginAdmin('owner');
  });

  it('books a named reformer spot and removes it from availability', () => {
    const startsAt = '2030-01-11T10:00:00.000Z';

    getScenarioData().then(({ service, clients, resource }) => {
      expect(resource, 'seeded spot resource').to.exist;

      createSession(service.id, 0, startsAt, resource.id).then((session) => {
        apiRequest('GET', `/schedule/sessions/${session.id}`).then((detailResponse) => {
          expect(detailResponse.status).to.eq(200);
          expect(detailResponse.body.freeSpots).to.have.length.greaterThan(0);

          const client = clients[0];
          const spot = detailResponse.body.freeSpots[0];
          openSession(session.id);

          selectOption('[data-cy="book-client-select"]', client.id);
          selectOption('[data-cy="book-spot-select"]', spot.id);

          cy.intercept('POST', '**/bookings').as('createBooking');
          cy.get('[data-cy="book-client-button"]').click();
          cy.wait('@createBooking').its('response.statusCode').should('eq', 201);

          cy.get('[data-cy="booking-row"]')
            .should('have.length', 1)
            .and('contain.text', client.name)
            .and('contain.text', spot.label)
            .and('contain.text', 'Reserved');
          cy.get('[data-cy="book-spot-select"]')
            .find(`option[value="${spot.id}"]`)
            .should('not.exist');
        });
      });
    });
  });

  it('rejects a spot booking when no spot was selected', () => {
    const startsAt = '2030-01-12T10:00:00.000Z';

    getScenarioData().then(({ service, clients, resource }) => {
      expect(resource, 'seeded spot resource').to.exist;

      createSession(service.id, 0, startsAt, resource.id).then((session) => {
        openSession(session.id);
        selectOption('[data-cy="book-client-select"]', clients[0].id);
        cy.get('[data-cy="book-spot-select"]').should('have.value', '');

        cy.intercept('POST', '**/bookings').as('missingSpotBooking');
        cy.get('[data-cy="book-client-button"]').click();
        cy.wait('@missingSpotBooking').its('response.statusCode').should('eq', 400);
        cy.get('[data-cy="schedule-detail-error"]').should('have.text', 'Failed to book client.');
        cy.get('[data-cy="booking-table"]').should('not.exist');
      });
    });
  });

  it('rejects a duplicate client booking without adding a second row', () => {
    const startsAt = '2030-01-13T10:00:00.000Z';

    getScenarioData().then(({ service, clients }) => {
      const client = clients[0];

      createSession(service.id, 2, startsAt).then((session) => {
        openSession(session.id);
        selectOption('[data-cy="book-client-select"]', client.id);

        cy.intercept('POST', '**/bookings').as('firstBooking');
        cy.get('[data-cy="book-client-button"]').click();
        cy.wait('@firstBooking').its('response.statusCode').should('eq', 201);
        cy.get('[data-cy="booking-row"]').should('have.length', 1);

        selectOption('[data-cy="book-client-select"]', client.id);
        cy.intercept('POST', '**/bookings').as('duplicateBooking');
        cy.get('[data-cy="book-client-button"]').click();
        cy.wait('@duplicateBooking').its('response.statusCode').should('eq', 400);

        cy.get('[data-cy="schedule-detail-error"]').should('have.text', 'Failed to book client.');
        cy.get('[data-cy="booking-row"]')
          .should('have.length', 1)
          .and('contain.text', client.name)
          .and('contain.text', 'Reserved');
      });
    });
  });

  it('rejects a second client when a headcount session is full', () => {
    const startsAt = '2030-01-14T10:00:00.000Z';

    getScenarioData().then(({ service, clients }) => {
      createSession(service.id, 1, startsAt).then((session) => {
        openSession(session.id);
        selectOption('[data-cy="book-client-select"]', clients[0].id);

        cy.intercept('POST', '**/bookings').as('capacityBooking');
        cy.get('[data-cy="book-client-button"]').click();
        cy.wait('@capacityBooking').its('response.statusCode').should('eq', 201);

        selectOption('[data-cy="book-client-select"]', clients[1].id);
        cy.intercept('POST', '**/bookings').as('fullBooking');
        cy.get('[data-cy="book-client-button"]').click();
        cy.wait('@fullBooking').its('response.statusCode').should('eq', 400);

        cy.get('[data-cy="schedule-detail-error"]').should('have.text', 'Failed to book client.');
        cy.get('[data-cy="booking-row"]')
          .should('have.length', 1)
          .and('contain.text', clients[0].name)
          .and('not.contain.text', clients[1].name);
      });
    });
  });

  it('promotes the first waiter when the reserved booking is cancelled', () => {
    const startsAt = '2030-01-15T10:00:00.000Z';
    const runId = Date.now();

    // Dedicated, uniquely-named clients rather than the shared scenario client list: repeated
    // Cypress runs against the same persisted dev database have accumulated near-duplicate names
    // (e.g. multiple "Alex Rivera ..." variants), which made the "not.contain.text" check below
    // false-positive against a same-prefixed but unrelated client.
    const createClient = (name) => apiRequest('POST', '/clients', {
      name, email: null, phone: null, notes: null, isActive: true, tags: [],
    }).then((res) => {
      expect(res.status).to.eq(201);
      return { id: res.body.id, name: res.body.name };
    });

    getScenarioData().then(({ service }) => {
      createClient(`Promo Booked ${runId}`).then((bookedClient) => {
      createClient(`Promo Waiting ${runId}`).then((waitingClient) => {

      createSession(service.id, 1, startsAt).then((session) => {
        apiRequest('POST', '/bookings', {
          scheduledSessionId: session.id,
          clientId: bookedClient.id,
          resourceSpotId: null,
        }).then((bookingResponse) => {
          expect(bookingResponse.status).to.eq(201);

          apiRequest('POST', '/schedule/waitlist', {
            scheduledSessionId: session.id,
            clientId: waitingClient.id,
          }).then((waitlistResponse) => {
            expect(waitlistResponse.status).to.eq(201);
            expect(waitlistResponse.body.position).to.eq(1);

            openSession(session.id);
            cy.get('[data-cy="booking-row"]')
              .should('have.length', 1)
              .and('contain.text', bookedClient.name)
              .and('contain.text', 'Reserved');

            cy.intercept('DELETE', '**/bookings/*').as('cancelBooking');
            cy.get('[data-cy="booking-cancel-button"]').click();
            cy.wait('@cancelBooking').its('response.statusCode').should('eq', 204);

            cy.get('[data-cy="booking-row"]')
              .should('have.length', 1)
              .and('contain.text', waitingClient.name)
              .and('contain.text', 'Reserved')
              .and('not.contain.text', bookedClient.name);

            apiRequest('GET', `/bookings?sessionId=${session.id}`).then((bookingsResponse) => {
              expect(bookingsResponse.status).to.eq(200);
              expect(bookingsResponse.body).to.have.length(1);
              expect(bookingsResponse.body[0].clientId).to.eq(waitingClient.id);
              expect(bookingsResponse.body[0].status).to.eq(0);
            });
          });
        });
      });
      });
      });
    });
  });

  it('assigns a real spot to a waitlisted client promoted into a spot-based session', () => {
    const startsAt = '2030-01-19T10:00:00.000Z';
    const runId = Date.now();

    const createClient = (name) => apiRequest('POST', '/clients', {
      name, email: null, phone: null, notes: null, isActive: true, tags: [],
    }).then((res) => {
      expect(res.status).to.eq(201);
      return { id: res.body.id, name: res.body.name };
    });

    getScenarioData().then(({ service, resource }) => {
      expect(resource, 'seeded spot resource').to.exist;

      // capacityOverride: 0 -> effective capacity falls back to the resource's own spot count.
      createSession(service.id, 0, startsAt, resource.id).then((session) => {
        apiRequest('GET', `/schedule/sessions/${session.id}`).then((detailResponse) => {
          const spots = detailResponse.body.freeSpots;
          expect(spots.length, 'seeded Reformer Studio spots').to.be.at.least(2);

          // Dedicated, uniquely-named clients -- the shared scenario client list has
          // accumulated duplicate names (e.g. multiple "Cancel Guest") across many prior runs,
          // which made a later cy.contains(name) lookup match the wrong row.
          const bookedClients = [];
          cy.wrap(spots).each((spot, i) => (
            createClient(`Spot Promo Client ${runId}-${i}`).then((client) => (
              apiRequest('POST', '/bookings', {
                scheduledSessionId: session.id,
                clientId: client.id,
                resourceSpotId: spot.id,
              }).then((res) => {
                expect(res.status).to.eq(201);
                bookedClients.push(client);
              })
            ))
          )).then(() => {
            createClient(`Spot Promo Waiter ${runId}`).then((waitingClient) => {
              apiRequest('POST', '/schedule/waitlist', {
                scheduledSessionId: session.id,
                clientId: waitingClient.id,
              }).then((waitlistResponse) => {
                expect(waitlistResponse.status).to.eq(201);

                const vacatedSpot = spots[0];
                const bookedClient = bookedClients[0];

                openSession(session.id);
                cy.intercept('DELETE', '**/bookings/*').as('cancelBooking');
                cy.contains('[data-cy="booking-row"]', bookedClient.name)
                  .find('[data-cy="booking-cancel-button"]').click();
                cy.wait('@cancelBooking').its('response.statusCode').should('eq', 204);

                // The promoted waiter must show the actual vacated seat, not "—" (no spot), and
                // that seat must not simultaneously read as still free.
                cy.contains('[data-cy="booking-row"]', waitingClient.name)
                  .should('contain.text', 'Reserved')
                  .find('td').eq(1).should('have.text', vacatedSpot.label);

                apiRequest('GET', `/schedule/sessions/${session.id}`).then((afterResponse) => {
                  expect(afterResponse.body.bookedCount).to.eq(spots.length);
                  expect(afterResponse.body.freeSpots).to.have.length(0);
                });

                apiRequest('GET', `/bookings?sessionId=${session.id}`).then((rosterResponse) => {
                  const promoted = rosterResponse.body.find((b) => b.clientId === waitingClient.id);
                  expect(promoted.resourceSpotId, 'promoted booking should have an assigned spot').to.not.be.null;
                  expect(promoted.spotLabel).to.eq(vacatedSpot.label);
                });
              });
            });
          });
        });
      });
    });
  });

  it('rejects duplicate waitlist entries and preserves the original queue position', () => {
    const startsAt = '2030-01-16T10:00:00.000Z';

    getScenarioData().then(({ service, clients }) => {
      createSession(service.id, 1, startsAt).then((session) => {
        const request = {
          scheduledSessionId: session.id,
          clientId: clients[1].id,
        };

        apiRequest('POST', '/schedule/waitlist', request).then((firstResponse) => {
          expect(firstResponse.status).to.eq(201);
          expect(firstResponse.body.position).to.eq(1);

          apiRequest('POST', '/schedule/waitlist', request).then((duplicateResponse) => {
            expect(duplicateResponse.status).to.eq(400);
            expect(duplicateResponse.body.errors.waitlist).to.deep.eq(['Already on waitlist.']);
          });
        });
      });
    });
  });

  it('checks in a reserved booking and removes cancellation actions', () => {
    const startsAt = '2030-01-17T10:00:00.000Z';

    getScenarioData().then(({ service, clients }) => {
      createSession(service.id, 2, startsAt).then((session) => {
        openSession(session.id);
        selectOption('[data-cy="book-client-select"]', clients[0].id);
        cy.get('[data-cy="book-client-button"]').click();
        cy.get('[data-cy="booking-row"]').should('contain.text', 'Reserved');

        cy.intercept('POST', '**/schedule/sessions/*/check-in').as('checkIn');
        cy.get('[data-cy="booking-checkin-button"]').click();
        cy.wait('@checkIn').its('response.statusCode').should('eq', 200);

        cy.get('[data-cy="booking-row"]')
          .should('have.length', 1)
          .and('contain.text', clients[0].name)
          .and('contain.text', 'CheckedIn');
        cy.get('[data-cy="booking-cancel-button"]').should('not.exist');
        cy.get('[data-cy="booking-checkin-button"]').should('not.exist');
      });
    });
  });

  it('hides a far-future session by default and reveals it via the date filter', () => {
    const startsAt = '2033-06-01T09:00:00.000Z';

    getScenarioData().then(({ service }) => {
      createSession(service.id, 0, startsAt).then((session) => {
        cy.visitAdmin('/schedule');
        cy.document().its('readyState').should('eq', 'complete');

        // Default 14-day window: a 2033 session shouldn't be there yet.
        cy.get(`[data-cy="schedule-row"][data-session-id="${session.id}"]`).should('not.exist');

        // Widening the "to" date and re-filtering brings it into view.
        cy.get('[data-cy="schedule-filter-to"]').invoke('val', '2033-06-02').trigger('change');
        cy.get('[data-cy="schedule-filter-apply"]').click();
        cy.get(`[data-cy="schedule-row"][data-session-id="${session.id}"]`).should('be.visible');

        // "Show all upcoming" clears the filter entirely and still shows it.
        cy.get('[data-cy="schedule-filter-clear"]').click();
        cy.get(`[data-cy="schedule-row"][data-session-id="${session.id}"]`).should('be.visible');
      });
    });
  });
});

describe('Schedule authorization — negative cases', { tags: ['@smoke'] }, () => {
  it('does not show Schedule navigation to a staff account', () => {
    cy.loginAdmin('staff');
    cy.get('[data-cy="nav-schedule"]').should('not.exist');
  });

  it('rejects staff session creation at the API boundary', () => {
    cy.loginAdmin('staff');

    apiRequest('GET', '/services').then((servicesResponse) => {
      expect(servicesResponse.status).to.eq(200);
      expect(servicesResponse.body).to.have.length.greaterThan(0);

      apiRequest('POST', '/schedule/sessions', {
        serviceId: servicesResponse.body[0].id,
        resourceId: null,
        primaryStaffMembershipId: null,
        startsAt: '2030-01-18T10:00:00.000Z',
        endsAt: '2030-01-18T11:00:00.000Z',
        capacityOverride: 1,
        isPublished: true,
        recurrenceRule: null,
        seriesId: null,
      }).then((response) => {
        expect(response.status).to.eq(403);
      });
    });
  });
});
