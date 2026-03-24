import { authOptions } from "@/lib/auth/config";
import NextAuth from "next-auth";

export default NextAuth(authOptions);
