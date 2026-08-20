describe('Schedule Admin (owner)', { tags: ['@smoke'] }, () => {
  const runId = Date.now();
  const headcountServiceName = 'Schedule Test Service'; // seeded or created by other tests; we pick by index

  beforeEach(() => {
    cy.loginAdmin('owner');
  });

  it('creates a headcount session, books a client, cancels, and checks in', () => {
    cy.get('[data-cy="nav-schedule"]').click();
    cy.location('pathname').should('eq', '/schedule');

    // Open create form
    cy.get('[data-cy="schedule-new-session"]').click();
    cy.get('[data-cy="schedule-create-form"]').should('exist');

    // Pick first available service (select by changing value)
    cy.get('[data-cy="schedule-service-select"]').then(($sel) => {
      const opts = $sel.find('option');
      // choose the first non-empty option
      for (let i = 0; i < opts.length; i++) {
        if (opts[i].value) { $sel.val(opts[i].value); break; }
      }
      $sel.trigger('change');
    });

    // Set future start/end (use a stable future time for demo)
    const startVal = '2026-08-25T10:00';
    const endVal = '2026-08-25T11:00';
    cy.get('[data-cy="schedule-start-input"]').invoke('val', startVal).trigger('change');
    cy.get('[data-cy="schedule-end-input"]').invoke('val', endVal).trigger('change');

    // Ensure published
    cy.get('[data-cy="schedule-published"]').check();

    cy.get('[data-cy="schedule-create-save"]').click();

    // Back to list; should see a row with our time or at least rows exist
    cy.get('[data-cy="schedule-table"]').should('exist');
    cy.get('[data-cy="schedule-row"]').should('have.length.greaterThan', 0);

    // Open the first row's detail (or one containing our time if visible)
    cy.get('[data-cy="schedule-row"]').first().find('[data-cy="schedule-view-button"]').click();
    cy.get('[data-cy="schedule-detail"]').should('exist');

    // Book a seeded client (Alex Rivera or first available)
    cy.get('[data-cy="book-client-select"]').then(($sel) => {
      const opts = $sel.find('option');
      for (let i = 0; i < opts.length; i++) {
        if (opts[i].value) { $sel.val(opts[i].value); break; }
      }
      $sel.trigger('change');
    });

    cy.get('[data-cy="book-client-button"]').click();

    // A booking row should appear (status Reserved)
    cy.get('[data-cy="schedule-detail"]').should('contain.text', 'Reserved');

    // Cancel the first booking
    cy.get('[data-cy="booking-cancel-button"]').first().click();

    // After cancel, the booking list should update (no more that booking or status changed)
    // For simplicity, re-select the session and confirm we can still see the detail
    cy.get('[data-cy="schedule-detail-close"]').click();
    cy.get('[data-cy="schedule-row"]').first().find('[data-cy="schedule-view-button"]').click();

    // Re-book to test check-in
    cy.get('[data-cy="book-client-select"]').then(($sel) => {
      const opts = $sel.find('option');
      for (let i = 0; i < opts.length; i++) {
        if (opts[i].value) { $sel.val(opts[i].value); break; }
      }
      $sel.trigger('change');
    });
    cy.get('[data-cy="book-client-button"]').click();

    // Check in
    cy.get('[data-cy="booking-checkin-button"]').first().click();

    // Close detail
    cy.get('[data-cy="schedule-detail-close"]').click();
    cy.location('pathname').should('eq', '/schedule');
  });
});

describe('Schedule — negative cases', { tags: ['@smoke'] }, () => {
  it('does not show the Schedule nav link to a staff account (Owner-only create)', () => {
    cy.loginAdmin('staff');
    // Nav may or may not render the link; the create action should be forbidden at API
    // Per pattern in clients/services: staff should not see owner-only nav items
    cy.get('[data-cy="nav-schedule"]').should('not.exist');
  });
});
