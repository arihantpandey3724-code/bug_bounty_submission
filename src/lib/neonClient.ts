import { neon } from "@neondatabase/serverless";

const rawUrl =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_CyptJD9rlw4E@ep-fancy-morning-b56i0rhs.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

// Clean URL: Strip -pooler and pgbouncer query params for HTTP serverless connection
const cleanUrl = rawUrl
  .replace("-pooler", "")
  .replace(/&pgbouncer=true/g, "")
  .replace(/\?pgbouncer=true&/g, "?")
  .replace(/\?pgbouncer=true/g, "");

export const sql = neon(cleanUrl);

export default sql;
