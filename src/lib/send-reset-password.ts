import ChangePasswordEmail from "../../emails/change-password-email";
import resend from "./resend";

export const sendResetPassword = async ({
  user,
  url,
}: {
  user: {
    email: string;
    name?: string | null;
  };
  url: string;
}) => {
  await resend.emails.send({
    from: "Axyl <contact@axyl.io.vn>",
    to: user.email,
    subject: "Reset your password",
    react: ChangePasswordEmail({
      userName: user.name ?? user.email,
      resetUrl: url,
    }),
    text: `Reset your account password: ${url}`,
  });
};
