declare module "nodemailer" {
  const nodemailer: { createTransport: (opts?: unknown) => { sendMail: (opts: unknown) => Promise<unknown> }; default: { createTransport: (opts?: unknown) => { sendMail: (opts: unknown) => Promise<unknown> } } };
  export default nodemailer;
}
