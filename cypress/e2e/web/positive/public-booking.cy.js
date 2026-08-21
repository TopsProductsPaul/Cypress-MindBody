const ownerLogin = () => (
  cy.request('POST', `${Cypress.env('apiBaseUrl')}/auth/login`, {
    Email: Cypress.env('loginCredentials').owner.email,
    Password: Cypress.env('loginCredentials').owner.password,
  }).then((res) => res.body.token)
);

const apiRequest = (token) => (method, path, body) => (
  cy.request({
    method,
    url: `${Cypress.env('apiBaseUrl')}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    body,
    failOnStatusCode: false,
  })
);

const createService = (request) => (
  request('POST', '/services', {
    Name: 'Public Site Test Service',
    Type: 0,
    DurationMinutes: 60,
    Capacity: 8,
    CreditCost: 1,
    BufferBeforeMinutes: 0,
    BufferAfterMinutes: 0,
    BookingOpensDaysBefore: 7,
    BookingClosesMinutesBefore: 0,
    CancellationWindowHours: 12,
    WaitlistMode: 1,
    IsActive: true,
  }).then((res) => res.body.id)
);

const createSession = (request, serviceId, startsAt, capacityOverride = 0, resourceId = null) => (
  request('POST', '/schedule/sessions', {
    serviceId,
    resourceId,
    primaryStaffMembershipId: null,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
    capacityOverride,
    isPublished: true,
    recurrenceRule: null,
    seriesId: null,
  }).then((res) => res.body)
);

describe('Public booking site', { tags: ['@smoke'] }, () => {
  let request;
  let serviceId;

  before(() => {
    ownerLogin().then((token) => {
      request = apiRequest(token);
      return createService(request).then((id) => { serviceId = id; });
    });
  });

  it('lists an upcoming session and shows remaining spots', () => {
    const startsAt = '2031-02-01T09:00:00.000Z';

    createSession(request, serviceId, startsAt).then((session) => {
      cy.visitWeb('/');
      cy.get(`[data-cy="public-session-row"][data-session-id="${session.id}"]`).should('be.visible').within(() => {
        cy.get('[data-cy="public-session-remaining"]').should('contain.text', '8 spots left');
      });
    });
  });

  it('books a headcount session as a guest and shows the confirmation', () => {
    const startsAt = '2031-02-02T09:00:00.000Z';
    const email = `guest-${Date.now()}@example.com`;

    createSession(request, serviceId, startsAt).then((session) => {
      cy.visitWeb(`/book/${session.id}`);
      cy.get('[data-cy="book-name-input"]').type('Jordan Guest');
      cy.get('[data-cy="book-email-input"]').type(email);
      cy.get('[data-cy="book-submit-button"]').click();

      cy.get('[data-cy="book-confirmation"]').should('be.visible').and('contain.text', "You're booked!");
    });
  });

  it('books a specific spot on a resource-backed session', () => {
    const startsAt = '2031-02-03T09:00:00.000Z';
    const email = `spot-guest-${Date.now()}@example.com`;

    request('GET', '/schedule/resources').then((resourcesRes) => {
      const resource = resourcesRes.body.find((r) => r.name === 'Reformer Studio');
      expect(resource, 'seeded spot resource').to.exist;

      createSession(request, serviceId, startsAt, 0, resource.id).then((session) => {
        cy.visitWeb(`/book/${session.id}`);
        cy.get('[data-cy="book-name-input"]').type('Spot Guest');
        cy.get('[data-cy="book-email-input"]').type(email);
        cy.get('[data-cy="book-spot-select"]').select(1);
        cy.get('[data-cy="book-submit-button"]').click();

        cy.get('[data-cy="book-confirmation"]').should('be.visible');
      });
    });
  });

  it('shows a full session as full and joins the waitlist instead of booking', () => {
    const startsAt = '2031-02-04T09:00:00.000Z';
    const email = `waitlist-guest-${Date.now()}@example.com`;

    createSession(request, serviceId, startsAt, 1).then((session) => {
      // Fill the only spot directly via the API first.
      request('POST', '/public/bookings', {
        sessionId: session.id,
        name: 'Filler Guest',
        email: `filler-${Date.now()}@example.com`,
      }).its('status').should('eq', 201);

      cy.visitWeb(`/book/${session.id}`);
      cy.get('[data-cy="book-full-notice"]').should('be.visible');
      cy.get('[data-cy="book-submit-button"]').should('contain.text', 'Join waitlist');

      cy.get('[data-cy="book-name-input"]').type('Waitlist Guest');
      cy.get('[data-cy="book-email-input"]').type(email);
      cy.get('[data-cy="book-submit-button"]').click();

      cy.get('[data-cy="book-confirmation"]').should('contain.text', "You're on the waitlist");
    });
  });

  it('finds and cancels a booking by email on the my-bookings page', () => {
    const startsAt = '2031-02-05T09:00:00.000Z';
    const email = `my-bookings-guest-${Date.now()}@example.com`;

    createSession(request, serviceId, startsAt).then((session) => {
      cy.visitWeb(`/book/${session.id}`);
      cy.get('[data-cy="book-name-input"]').type('MyBookings Guest');
      cy.get('[data-cy="book-email-input"]').type(email);
      cy.get('[data-cy="book-submit-button"]').click();
      cy.get('[data-cy="book-confirmation"]').should('be.visible');

      cy.visitWeb('/my-bookings');
      cy.get('[data-cy="my-bookings-email-input"]').type(email);
      cy.get('[data-cy="my-bookings-lookup-button"]').click();

      cy.get('[data-cy="my-bookings-row"]').should('have.length', 1);
      cy.get('[data-cy="my-bookings-cancel-button"]').click();

      cy.get('[data-cy="my-bookings-empty"]').should('be.visible');
    });
  });

  it('rejects an empty name/email on the booking form', () => {
    const startsAt = '2031-02-06T09:00:00.000Z';

    createSession(request, serviceId, startsAt).then((session) => {
      cy.visitWeb(`/book/${session.id}`);
      cy.get('[data-cy="book-submit-button"]').click();

      cy.get('[data-cy="book-error"]').should('be.visible');
      cy.get('[data-cy="book-confirmation"]').should('not.exist');
    });
  });
});
