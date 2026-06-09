## ADDED Requirements

### Requirement: Platform default upstream configuration MUST remain server-side

The system MUST allow ordinary users to use the platform default upstream image API without exposing the platform default Base URL or API Key to the browser UI or public API responses.

#### Scenario: Ordinary user opens API settings

- **WHEN** an ordinary user opens the API configuration dialog
- **THEN** the dialog defaults to platform mode
- **AND** the platform default Base URL is not rendered
- **AND** the platform default API Key is not rendered

#### Scenario: Generation uses platform default

- **WHEN** an authenticated user submits a generation request without a custom upstream configuration
- **THEN** the server uses the platform default upstream configuration
- **AND** the response does not include the platform default API Key

### Requirement: Users MAY provide local custom upstream configuration

The system MUST allow authenticated users to provide their own upstream Base URL, API Key, model ID, and full URL mode for generation requests, while storing that configuration only in the browser.

#### Scenario: User saves custom upstream settings

- **WHEN** a user switches API settings to custom upstream mode
- **AND** provides a valid Base URL and API Key
- **THEN** the browser stores the custom configuration locally
- **AND** subsequent generation requests include the custom configuration

#### Scenario: User tests custom upstream settings

- **WHEN** an authenticated user tests a custom upstream configuration
- **THEN** the server validates the custom configuration
- **AND** the server tests that custom upstream instead of the platform default

### Requirement: Admins MUST manage platform default upstream configuration

The system MUST provide an administrator-only interface and API for reading and updating the platform default upstream configuration.

#### Scenario: Admin views default upstream configuration

- **WHEN** an administrator opens the admin page
- **THEN** the page shows the default Base URL, model ID, full URL mode, and API Key presence
- **AND** the API Key is not returned in plaintext

#### Scenario: Admin saves default upstream configuration

- **WHEN** an administrator updates the default upstream configuration
- **THEN** the server saves it to the `app_settings` table
- **AND** future platform-default generation requests use the saved database configuration

#### Scenario: Non-admin accesses default upstream API

- **WHEN** a non-admin user calls the default upstream configuration API
- **THEN** the server rejects the request with an admin authorization error
