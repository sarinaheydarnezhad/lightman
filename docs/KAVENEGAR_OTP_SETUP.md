# Kavenegar verification for signup and password recovery

Normal Lerona login uses mobile number and password. SMS is required for new
signup and forgotten-password recovery; verifying a code does not issue a session.

See [the frontend contract](phone-authentication.md) and the backend
`docs/PHONE_PASSWORD_OTP_REPORT.md` / `docs/KAVENEGAR_OTP_SETUP.md` for server setup.
Only the public API URL belongs in the mobile app. Provider keys must be injected
into the backend environment, never an Expo public variable or a tracked file.

No real SMS delivery, backend deployment or database migration was performed.
