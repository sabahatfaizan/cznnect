Paste each file into Supabase > Authentication > Emails (templates), with the subject shown.

confirm-signup.html  ->  subject: Confirm your email address for Cznnect
reset-password.html  ->  subject: Reset your Cznnect password
password-changed.html  ->  subject: Your Cznnect password was changed

confirm-signup and reset-password use {{ .ConfirmationURL }}. password-changed is for the "password changed" security notification (no link variable needed).
The copyright year is fixed when the file was generated (2026).
