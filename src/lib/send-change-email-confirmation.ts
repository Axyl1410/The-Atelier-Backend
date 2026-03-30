import ChangeEmailEmail from "../../emails/change-email-email";
import resend from "./resend";

export const sendChangeEmailConfirmation = async ({
  user,
  newEmail,
  url,
}: {
  user: {
    email: string;
    name?: string | null;
  };
  newEmail: string;
  url: string;
}) => {
  await resend.emails.send({
    from: "Axyl <contact@axyl.io.vn>",
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
