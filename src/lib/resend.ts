import { Resend } from "resend";
import { env } from "../utils/cf-util";

const resend = new Resend(env.RESEND_API_KEY);

export default resend;
