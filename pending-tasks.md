- add unsubscribe option to transactional emails. add this field to user schema. If present, never submit email to these users.
- Add env option REQUIRE_EMAIL_VERIFICATION. By default set to false. If false, automatically create new users on /auth/register as already verified

- Theres this schema bug where we can be in a state where UserStatus = PendingVerification and email_verified = true. Ideally we should rely only on UserStatus
