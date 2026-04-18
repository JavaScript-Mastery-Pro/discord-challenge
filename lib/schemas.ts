import { z } from "zod";

export const updateSchema = z.object({
  name: z.string().min(1).optional(),
  department: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  academicHistory: z
    .array(
      z.object({
        year: z.string(),
        title: z.string(),
      }),
    )
    .max(20)
    .optional(),
});
