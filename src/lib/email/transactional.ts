import ChangeEmailEmail from "../../emails/change-email-email";
import ChangePasswordEmail from "../../emails/change-password-email";
import VerifyAccountEmail from "../../emails/verify-account-email";
import { resend } from "./resend";

const AUTH_MAIL_FROM = "Axyl <contact@axyl.io.vn>";

export interface AuthMailUser {
  email: string;
  name?: string | null;
}

export const sendVerificationEmail = async ({
  user,
  url,
}: {
  user: AuthMailUser;
  url: string;
}) => {
  await resend.emails.send({
    from: AUTH_MAIL_FROM,
    to: user.email,
    subject: "Verify your email address",
    react: VerifyAccountEmail({
      userName: user.name ?? user.email,
      verifyUrl: url,
    }),
    text: `Verify your account: ${url}`,
  });
};

export const sendResetPassword = async ({
  user,
  url,
}: {
  user: AuthMailUser;
  url: string;
}) => {
  await resend.emails.send({
    from: AUTH_MAIL_FROM,
    to: user.email,
    subject: "Reset your password",
    react: ChangePasswordEmail({
      userName: user.name ?? user.email,
      resetUrl: url,
    }),
    text: `Reset your account password: ${url}`,
  });
};

export const sendChangeEmailConfirmation = async ({
  user,
  newEmail,
  url,
}: {
  user: AuthMailUser;
  newEmail: string;
  url: string;
}) => {
  await resend.emails.send({
    from: AUTH_MAIL_FROM,
    to: user.email,
    subject: "Confirm your email change",
    react: ChangeEmailEmail({
      userName: user.name ?? user.email,
      newEmail,
      confirmUrl: url,
    }),
    text: `Confirm changing your account email to ${newEmail}: ${url}`,
  });
};
