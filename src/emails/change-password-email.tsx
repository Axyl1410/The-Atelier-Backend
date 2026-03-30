import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
// biome-ignore lint/correctness/noUnusedImports: required by tsconfig jsx=react for TSX transform
import React from "react";

interface ChangePasswordEmailProps {
  resetUrl: string;
  userName?: string;
}

export default function ChangePasswordEmail({
  userName,
  resetUrl,
}: ChangePasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Axyl password</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section>
            <Img
              alt="Axyl"
              height="40"
              src={"https://nguyentruonggiang.id.vn/favicon.ico"}
              style={logo}
              width="40"
            />
            <Text style={text}>Hi {userName ?? "there"},</Text>
            <Text style={text}>
              We received a request to reset your Axyl account password.
            </Text>
            <Text style={text}>
              If this was you, set a new password using the button below:
            </Text>
            <Button href={resetUrl} style={button}>
              Reset password
            </Button>
            <Text style={text}>
              If you did not request this, you can safely ignore this email.
            </Text>
            <Text style={text}>Best regards,</Text>
            <Text style={text}>Axyl Team</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

ChangePasswordEmail.PreviewProps = {
  userName: "Alex",
  resetUrl: "https://example.com/reset-password",
} as ChangePasswordEmailProps;

const body = {
  backgroundColor: "#f6f9fc",
  padding: "20px 0",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e6ebf1",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "28px",
};

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};

const button = {
  backgroundColor: "#111827",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600",
  padding: "12px 18px",
  textDecoration: "none",
  margin: "8px 0 16px",
};

const logo = {
  margin: "0 0 16px",
};
