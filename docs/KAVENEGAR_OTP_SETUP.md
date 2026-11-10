# Kavenegar SMS-only authentication

The frontend has one SMS OTP flow for login and registration. Password, Google and
separate credential-based activation are disabled in both the client and backend.
No email, password, Google identity or username is required.

See [the backend setup and legacy recovery guide](../../Backend/docs/KAVENEGAR_OTP_SETUP.md)
and [the current frontend contract](phone-authentication.md).

Real provider settings belong only in Git-ignored `Backend/.env`; `.env.example`
contains placeholders. The backend loads these settings directly. No provider
secrets are included in frontend configuration, code or reports. The Google SDK
dependency/plugin and native sign-in bridge have been removed.

Local configuration loading passed. Live provider permissions, debug-mode state,
template approval and actual delivery are not confirmed by this run. No real SMS
or production deployment is authorized without the user's explicit approval.
