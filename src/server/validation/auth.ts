import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  next: z.string().max(500).optional(),
});

export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

export const resetSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: z.string().min(10).max(200),
    confirm: z.string().min(1).max(200),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });
