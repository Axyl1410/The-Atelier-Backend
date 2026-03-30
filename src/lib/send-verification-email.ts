import VerifyAccountEmail from "../../emails/verify-account-email";
import resend from "./resend";

export const sendVerificationEmail = async ({
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
    subject: "Verify your email address",
    react: VerifyAccountEmail({
      userName: user.name ?? user.email,
      verifyUrl: url,
    }),
    text: `Verify your account: ${url}`,
  });
};
