## ADDED Requirements

### Requirement: New email password registrations MUST verify email confirmation link

The system MUST require a new email address to click a Supabase email confirmation link before the account can complete password registration and access the application.

#### Scenario: New email starts registration

- **WHEN** a visitor submits an email and password for an email address that is not an existing confirmed account
- **THEN** the system sends an email confirmation link
- **AND** the system returns a confirmation-required response
- **AND** the visitor is not treated as a completed password user until the link is confirmed

#### Scenario: New email confirms registration link

- **WHEN** the visitor clicks a valid email confirmation link
- **THEN** the system confirms the email
- **AND** establishes a login session
- **AND** allows future password login with the submitted password

#### Scenario: Invalid registration confirmation link

- **WHEN** the visitor opens an invalid or expired confirmation link
- **THEN** the system redirects back to the auth page with a callback error
- **AND** does not complete password registration

#### Scenario: Unconfirmed registration resends confirmation link

- **WHEN** a visitor submits the same unconfirmed email and password again
- **THEN** the system resends a signup confirmation link
- **AND** does not create a second confirmed account

### Requirement: Existing password login MUST NOT send email confirmation

The system MUST allow confirmed users to log in with email and password without sending an email confirmation message.

#### Scenario: Existing user logs in with correct password

- **WHEN** a confirmed user submits the correct email and password
- **THEN** the system signs the user in
- **AND** does not send an email confirmation message

#### Scenario: Existing user submits wrong password

- **WHEN** a confirmed user submits an incorrect password
- **THEN** the system rejects the login with a generic credential error
- **AND** does not send an email confirmation message

#### Scenario: Completed registration logs in later

- **WHEN** a user has already completed email confirmation registration
- **AND** later submits the correct email and password
- **THEN** the system signs the user in without requiring another email confirmation
