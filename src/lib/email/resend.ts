import { Resend } from "resend";
import { env } from "../../utils/cf-util";

export const resend = new Resend(env.RESEND_API_KEY);
