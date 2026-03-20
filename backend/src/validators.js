import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const memberRegisterSchema = z.object({
  full_name: z.string().min(2),
  username: z.string().min(3),
  password: z.string().min(6),
  membership_type: z.enum(["monthly", "annual"]).optional().default("monthly"),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable()
});

export const trainerCreateSchema = z.object({
  full_name: z.string().min(2),
  specialty: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  status: z.enum(["active", "inactive"]).optional().default("active")
});

export const memberCreateSchema = z.object({
  full_name: z.string().min(2),
  membership_type: z.enum(["monthly", "annual"]),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  assigned_trainer_id: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  emergency_contact: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export const attendanceCreateSchema = z.object({
  member_id: z.string().min(1),
  check_in_at: z.string().optional()
});

export const paymentCreateSchema = z.object({
  member_id: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["cash", "card", "gcash", "bank"]),
  paid_at: z.string().optional()
});

export const userUpsertSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6).optional(),
  role: z.enum(["admin", "trainer", "staff"])
});

export const accountFreezeSettingsSchema = z.object({
  enabled: z.boolean().optional().default(false),
  inactive_days: z.number().int().positive().max(3650).optional().default(30),
  include_never_used: z.boolean().optional().default(false)
});

