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

interface VerifyAccountEmailProps {
  userName?: string;
  verifyUrl: string;
}

export default function VerifyAccountEmail({
  userName,
  verifyUrl,
}: VerifyAccountEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your Axyl account</Preview>
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
              Someone recently requested an email verification for your Axyl
              account. If this was you, you can verify your email here:
            </Text>
            <Button href={verifyUrl} style={button}>
              Verify account
            </Button>
            <Text style={text}>
              If you did not create this account, you can safely ignore this
              email.
            </Text>
            <Text style={text}>Best regards,</Text>
            <Text style={text}>Axyl Team</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

VerifyAccountEmail.PreviewProps = {
  userName: "Alex",
  verifyUrl: "https://example.com/verify-email",
} as VerifyAccountEmailProps;

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
